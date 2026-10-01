import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';




@Injectable()
export class TasksService {
  private databaseService: DatabaseService;

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
  }


  async createTask(userId: number, projectId: number, dto: CreateTaskDto) {
    await this.checkMember(userId, projectId);
    await this.checkAssignee(projectId, dto.assignee_id);

    const pool = this.databaseService.getPool();
    let status = 'todo';
    if (dto.status) {
      status = dto.status;
    }
    const result = await pool.query(
      'INSERT INTO tasks (title, description, priority, status, due_date, project_id, assignee_id, created_by_user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, title, description, priority, status, due_date, project_id, assignee_id, created_by_user_id, created_at',
      [
        dto.title,
        dto.description,
        dto.priority,
        status,
        dto.due_date,
        projectId,
        dto.assignee_id,
        userId,
      ],
    );
    return result.rows[0];
  }

  async listTasks(userId: number, projectId: number) {
    await this.checkMember(userId, projectId);

    const pool = this.databaseService.getPool();
    const result = await pool.query(
      'SELECT id, title, description, priority, status, due_date, project_id, assignee_id, created_by_user_id, created_at FROM tasks WHERE project_id = $1 ORDER BY id',
      [projectId],
    );
    return result.rows;
  }


  async getTask(userId: number, projectId: number, taskId: number) {
    await this.checkMember(userId, projectId);
    return this.taskRow(projectId, taskId);
  }

  // null clears assignee and only undefined keeps old value
  async updateTask(
    userId: number,
    projectId: number,
    taskId: number,
    dto: UpdateTaskDto,
  ) {
    await this.checkMember(userId, projectId);
    const existing = await this.taskRow(projectId, taskId);

    if (dto.assignee_id !== undefined && dto.assignee_id !== null) {
      await this.checkAssignee(projectId, dto.assignee_id);
    }

    let title = existing.title;
    if (dto.title !== undefined && dto.title !== null) {
      title = dto.title;
    }
    let description = existing.description;
    if (dto.description !== undefined && dto.description !== null) {
      description = dto.description;
    }
    let priority = existing.priority;
    if (dto.priority !== undefined && dto.priority !== null) {
      priority = dto.priority;
    }
    let status = existing.status;
    if (dto.status !== undefined && dto.status !== null) {
      status = dto.status;
    }
    let dueDate = existing.due_date;
    if (dto.due_date !== undefined && dto.due_date !== null) {
      dueDate = dto.due_date;
    }
    // Sending assignee_id null must clear the assignee, so only undefined keeps the old value
    let assigneeId = existing.assignee_id;
    if (dto.assignee_id !== undefined) {
      assigneeId = dto.assignee_id;
    }

    const pool = this.databaseService.getPool();
    const result = await pool.query(
      'UPDATE tasks SET title = $1, description = $2, priority = $3, status = $4, due_date = $5, assignee_id = $6 WHERE id = $7 AND project_id = $8 RETURNING id, title, description, priority, status, due_date, project_id, assignee_id, created_by_user_id, created_at',
      [
        title,
        description,
        priority,
        status,
        dueDate,
        assigneeId,
        taskId,
        projectId,
      ],
    );
    return result.rows[0];
  }

  // Dcreator or project owner only
  async deleteTask(userId: number, projectId: number, taskId: number) {
    await this.checkMember(userId, projectId);

    const pool = this.databaseService.getPool();

    const task = await pool.query(
      'SELECT created_by_user_id FROM tasks WHERE id = $1 AND project_id = $2',
      [taskId, projectId],
    );
    if (task.rows.length === 0) {
      throw new NotFoundException('Task not found');
    }

    const project = await pool.query(
      'SELECT owner_id FROM projects WHERE id = $1',
      [projectId],
    );
    const isCreator = task.rows[0].created_by_user_id === userId;
    const isOwner = project.rows[0].owner_id === userId;
    if (!isCreator && !isOwner) {
      throw new ForbiddenException(
        'Only task creator or project owner can delete this task , please contact them',
      );
    }

    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    return { message: 'Task deleted' };
  }


  private async taskRow(projectId: number, taskId: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.query(
      'SELECT id, title, description, priority, status, due_date, project_id, assignee_id, created_by_user_id, created_at FROM tasks WHERE id = $1 AND project_id = $2',
      [taskId, projectId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException('Task not found');
    }
    return result.rows[0];
  }

  // 404 missing ,403 user not member
  private async checkMember(userId: number, projectId: number) {

    const pool = this.databaseService.getPool();

    const project = await pool.query('SELECT id FROM projects WHERE id = $1', [
      projectId,
    ]);
    if (project.rows.length === 0) {
      throw new NotFoundException('Project not found');
    }

    const member = await pool.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId],
    );
    if (member.rows.length === 0) {
      throw new ForbiddenException('You are not a member of this project');
    }
  }

  // if no assignee given, nothing to check hee
  private async checkAssignee(projectId: number, assigneeId?: number | null) {
    if (assigneeId === undefined || assigneeId === null) {
      return;
    }

    const pool = this.databaseService.getPool();
    const member = await pool.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, assigneeId],
    );
    if (member.rows.length === 0) {
      throw new BadRequestException(
        'Assignee must be a member of this project',
      );
    }
  }
}
