import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  private databaseService: DatabaseService;

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
  }

  // owner is also a member otherwise listProjects won't show it
  async createProject(userId: number, dto: CreateProjectDto) {
    const pool = this.databaseService.getPool();

    const created = await pool.query(
      'INSERT INTO projects (name, description, deadline, owner_id) VALUES ($1, $2, $3, $4) RETURNING id, name, description, deadline, owner_id, created_at',
      [dto.name, dto.description, dto.deadline, userId],
    );
    const project = created.rows[0];

    await pool.query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)',
      [project.id, userId],
    );
    return project;
  }


  async listProjects(userId: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.query(
      'SELECT p.id, p.name, p.description, p.deadline, p.owner_id, p.created_at FROM projects p JOIN project_members m ON m.project_id = p.id WHERE m.user_id = $1 ORDER BY p.id',
      [userId],
    );
    return result.rows;
  }

  // 404 if not a member
  async getProject(userId: number, projectId: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.query(
      'SELECT p.id, p.name, p.description, p.deadline, p.owner_id, p.created_at FROM projects p JOIN project_members m ON m.project_id = p.id WHERE m.user_id = $1 AND p.id = $2',
      [userId, projectId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException('Project not found');
    }
    return result.rows[0];
  }

  // only owner 
  async updateProject(userId: number, projectId: number, dto: UpdateProjectDto) {
    await this.checkOwner(
      userId,
      projectId,
      'Only the owner can update this project',
    );

    const pool = this.databaseService.getPool();

    const found = await pool.query(
      'SELECT id, name, description, deadline, owner_id, created_at FROM projects WHERE id = $1',
      [projectId],
    );
    const existing = found.rows[0];

    let name = existing.name;
    if (dto.name !== undefined && dto.name !== null) {
      name = dto.name;
    }
    let description = existing.description;
    if (dto.description !== undefined && dto.description !== null) {
      description = dto.description;
    }
    let deadline = existing.deadline;
    if (dto.deadline !== undefined && dto.deadline !== null) {
      deadline = dto.deadline;
    }

    const result = await pool.query(
      'UPDATE projects SET name = $1, description = $2, deadline = $3 WHERE id = $4 RETURNING id, name, description, deadline, owner_id, created_at',
      [name, description, deadline, projectId],
    );
    return result.rows[0];
  }

  // only owner 
  async deleteProject(userId: number, projectId: number) {
    await this.checkOwner(
      userId,
      projectId,
      'Only owner can delte this project, you are not owner so do not try',
    );

    const pool = this.databaseService.getPool();
    await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    return { message: 'Project deleted' };
  }

  
  async addMember(userId: number, projectId: number, dto: AddMemberDto) {
    await this.checkOwner(
      userId,
      projectId,
      'Only owner can add members to this project bro you can not so give up already',
    );

    const pool = this.databaseService.getPool();

    const user = await pool.query('SELECT id FROM users WHERE email = $1', [
      dto.email,
    ]);
    if (user.rows.length === 0) {
      throw new NotFoundException('User not found');
    }
    const newMemberId = user.rows[0].id;

    const existing = await pool.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, newMemberId],
    );
    if (existing.rows.length > 0) {
      throw new ConflictException('User is already member');
    }

    await pool.query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)',
      [projectId, newMemberId],
    );
    return { message: 'Member added' };
  }


  async listMembers(userId: number, projectId: number) {
    const pool = this.databaseService.getPool();

    const access = await pool.query(
      'SELECT p.id FROM projects p JOIN project_members m ON m.project_id = p.id WHERE m.user_id = $1 AND p.id = $2',
      [userId, projectId],
    );
    if (access.rows.length === 0) {
      throw new NotFoundException('Project not found');
    }

    const result = await pool.query(
      'SELECT u.id, u.name, u.email FROM users u JOIN project_members m ON m.user_id = u.id WHERE m.project_id = $1 ORDER BY u.id',
      [projectId],
    );
    return result.rows;
  }

  // databaase won't allow deletion of member who has assigned tasks . 
  async removeMember(userId: number, projectId: number, memberId: number) {
    await this.checkOwner(
      userId,
      projectId,
      'Only owner can remove members from this project, call owner to do that',
    );

    if (memberId === userId) {
      throw new BadRequestException('owner cannot be removed , how can you do this to owner ?');
    }

    const pool = this.databaseService.getPool();

    const existing = await pool.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, memberId],
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException('User is not a member');
    }

    // database refuses to remove a member who still has tasks assigned, so need to unassign them first
    await pool.query(
      'UPDATE tasks SET assignee_id = NULL WHERE project_id = $1 AND assignee_id = $2',
      [projectId, memberId],
    );

    await pool.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, memberId],
    );
    return { message: 'Member removed' };
  }

  // 404 if the project is missing and 403 if the user is not its owner
  private async checkOwner(userId: number, projectId: number, message: string) {
    const pool = this.databaseService.getPool();

    const result = await pool.query(
      'SELECT owner_id FROM projects WHERE id = $1',
      [projectId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException('Project not found');
    }
    if (result.rows[0].owner_id !== userId) {
      throw new ForbiddenException(message);
    }
  }
}
