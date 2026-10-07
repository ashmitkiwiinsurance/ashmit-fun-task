import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Pool } from 'pg';
import { AppModule } from './../src/app.module';
import { DatabaseService } from './../src/database/database.service';

describe('TaskFlow API (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let owner: { id: number; token: string };
  let member: { id: number; token: string };
  let stranger: { id: number; token: string };


  function post(path: string, token: string, body?: object) {
    return request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  function get(path: string, token: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);
  }

  function patch(path: string, token: string, body?: object) {
    return request(app.getHttpServer())
      .patch(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  function del(path: string, token: string) {
    return request(app.getHttpServer())
      .delete(path)
      .set('Authorization', `Bearer ${token}`);
  }

  // Sign up user her , logs them in, and hands back their id and token
  async function registerAndLogin(name: string, email: string) {
    const registered = await request(app.getHttpServer())
      .post('/users')
      .send({ name, email, password: 'secret123' });
    const login = await request(app.getHttpServer())
      .post('/users/login')
      .send({ email, password: 'secret123' });
    return { id: registered.body.id, token: login.body.token };
  }

  // Creates a project as the owner and returns its id.
  async function createProject(name: string) {
    const res = await post('/projects', owner.token, { name });
    return res.body.id;
  }

  // Same as createProject, but the member is already on the project.
  // Relies on the member's email from beforeAll below.
  async function createProjectWithMember(name: string) {
    const projectId = await createProject(name);
    await post(`/projects/${projectId}/members`, owner.token, {
      email: 'e2e-member@example.com',
    });
    return projectId;
  }

  beforeAll(async () => {
    // Safety net: this suite wipes tables, so never let it touch a real database.
    if (process.env.DB_NAME !== 'taskflow_api_test') {
      throw new Error('E2E tests must run on taskflow_api_test only');
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Same validation setup as main.ts, otherwise the 400 tests wouldn't mean anything.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Start every run from an empty database with ids back at 1.
    pool = app.get(DatabaseService).getPool();
    await pool.query(
      'TRUNCATE tasks, project_members, projects, users RESTART IDENTITY CASCADE',
    );

    // Three users cover every permission case: owner, member, and someone with no access.
    owner = await registerAndLogin('Owner', 'e2e-owner@example.com');
    member = await registerAndLogin('Member', 'e2e-member@example.com');
    stranger = await registerAndLogin('Stranger', 'e2e-stranger@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('auth', () => {
    it('registers a user without returning any password field', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'New User',
          email: 'e2e-new@example.com',
          password: 'secret123',
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('New User');
      expect(res.body.email).toBe('e2e-new@example.com');
      expect(res.body.created_at).toBeDefined();
      // Neither the raw password nor the hash should ever leave the API
      expect(res.body.password).toBeUndefined();
      expect(res.body.password_hash).toBeUndefined();
    });

    it('rejects a duplicate email with 409', async () => {
      // The owner was registered in beforeAll, so this email is already taken
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Owner Again',
          email: 'e2e-owner@example.com',
          password: 'secret123',
        });
      expect(res.status).toBe(409);
    });

    it('logs in with correct credentials and returns a token', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/login')
        .send({ email: 'e2e-owner@example.com', password: 'secret123' });
      expect(res.status).toBe(201);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(0);
    });

    it('rejects a wrong password with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/login')
        .send({ email: 'e2e-owner@example.com', password: 'wrongpass1' });
      expect(res.status).toBe(401);
    });

    it('rejects GET /projects without a token with 401', async () => {
      const res = await request(app.getHttpServer()).get('/projects');
      expect(res.status).toBe(401);
    });
  });

  describe('projects', () => {
    let sharedProjectId: number;

    // Only for read-only checks. Tests that change or delete things make their own project
    beforeAll(async () => {
      sharedProjectId = await createProjectWithMember('Projects Shared');
    });

    it('creates a project owned by the creator', async () => {
      const res = await post('/projects', owner.token, {
        name: 'Created Project',
      });
      expect(res.status).toBe(201);
      expect(res.body.owner_id).toBe(owner.id);
    });

    it('lists only my projects', async () => {
      const projectA = await createProject('List Project A');
      const strangerRes = await post('/projects', stranger.token, {
        name: 'List Project B',
      });
      const projectB = strangerRes.body.id;

      const res = await get('/projects', owner.token);
      expect(res.status).toBe(200);
      const ids = [];
      for (const project of res.body) {
        ids.push(project.id);
      }
      expect(ids).toContain(projectA);
      // The stranger's project must not show up in the owner's list
      expect(ids).not.toContain(projectB);
    });

    it('does not let a non-owner member delete a project', async () => {
      const res = await del(`/projects/${sharedProjectId}`, member.token);
      expect(res.status).toBe(403);
    });

    it('lets the owner delete a project and removes its tasks', async () => {
      const projectId = await createProject('Delete Project');
      await post(`/projects/${projectId}/tasks`, owner.token, {
        title: 'Doomed task',
        priority: 'low',
      });

      const deleted = await del(`/projects/${projectId}`, owner.token);
      expect(deleted.status).toBe(200);

      const fetched = await get(`/projects/${projectId}`, owner.token);
      expect(fetched.status).toBe(404);

      // Query the table directly: the API can't show us tasks of a deleted project,
      // so this is the only way to confirm the cascade actually happened
      const tasks = await pool.query(
        'SELECT id FROM tasks WHERE project_id = $1',
        [projectId],
      );
      expect(tasks.rows.length).toBe(0);
    });

    it('returns 404 for a project that does not exist', async () => {
      const res = await get('/projects/9999', owner.token);
      expect(res.status).toBe(404);
    });
  });

  describe('members', () => {
    let sharedProjectId: number;

    beforeAll(async () => {
      sharedProjectId = await createProjectWithMember('Members Shared');
    });

    it('lets the owner add a member by email', async () => {
      // Plain createProject here, because adding the member is what we're testing.
      const projectId = await createProject('Add Member Project');
      const res = await post(`/projects/${projectId}/members`, owner.token, {
        email: 'e2e-member@example.com',
      });
      expect(res.status).toBe(201);

      const list = await get(`/projects/${projectId}/members`, owner.token);
      expect(list.status).toBe(200);
      const ids = [];
      for (const person of list.body) {
        ids.push(person.id);
      }
      expect(ids).toContain(member.id);
    });

    it('does not let a non-owner member add a member', async () => {
      const res = await post(
        `/projects/${sharedProjectId}/members`,
        member.token,
        { email: 'e2e-stranger@example.com' },
      );
      expect(res.status).toBe(403);
    });

    it('lets the owner remove a member', async () => {
      const projectId = await createProjectWithMember('Remove Member Project');
      const res = await del(
        `/projects/${projectId}/members/${member.id}`,
        owner.token,
      );
      expect(res.status).toBe(200);

      const list = await get(`/projects/${projectId}/members`, owner.token);
      const ids = [];
      for (const person of list.body) {
        ids.push(person.id);
      }
      expect(ids).not.toContain(member.id);
    });

    it('unassigns a removed member from their tasks', async () => {
      // The member is already on the project, so the task can be assigned to them right away.
      const projectId = await createProjectWithMember('Unassign Project');
      const task = await post(`/projects/${projectId}/tasks`, owner.token, {
        title: 'Assigned task',
        priority: 'medium',
        assignee_id: member.id,
      });
      expect(task.body.assignee_id).toBe(member.id);

      await del(`/projects/${projectId}/members/${member.id}`, owner.token);

      // The task should survive, just without an assignee.
      const after = await get(
        `/projects/${projectId}/tasks/${task.body.id}`,
        owner.token,
      );
      expect(after.status).toBe(200);
      expect(after.body.assignee_id).toBeNull();
    });
  });

  describe('tasks', () => {
    let projectId: number;

    // One project for the whole block: owner, member on it, stranger left out.
    beforeAll(async () => {
      projectId = await createProjectWithMember('Tasks Project');
    });

    it('lets a member create a task', async () => {
      const res = await post(`/projects/${projectId}/tasks`, member.token, {
        title: 'Member task',
        priority: 'high',
      });
      expect(res.status).toBe(201);
      expect(res.body.project_id).toBe(projectId);
    });

    it('does not let a non-member create a task', async () => {
      const res = await post(`/projects/${projectId}/tasks`, stranger.token, {
        title: 'Stranger task',
        priority: 'high',
      });
      expect(res.status).toBe(403);
    });

    it('rejects assigning a task to a non-member on create and update', async () => {
      // Case 1: assignee is invalid from the start.
      const onCreate = await post(
        `/projects/${projectId}/tasks`,
        member.token,
        { title: 'Bad assignee', priority: 'low', assignee_id: stranger.id },
      );
      expect(onCreate.status).toBe(400);

      // Case 2: a valid task gets a bad assignee later.
      const task = await post(`/projects/${projectId}/tasks`, member.token, {
        title: 'Assign later',
        priority: 'low',
      });
      const onUpdate = await patch(
        `/projects/${projectId}/tasks/${task.body.id}`,
        member.token,
        { assignee_id: stranger.id },
      );
      expect(onUpdate.status).toBe(400);
    });

    it('updates only the status and leaves other fields unchanged', async () => {
      // Fill in every field so we can tell if a partial update wipes any of them.
      const created = await post(`/projects/${projectId}/tasks`, member.token, {
        title: 'Full task',
        description: 'keep me',
        priority: 'high',
        due_date: '2026-11-15',
        assignee_id: member.id,
      });
      const taskId = created.body.id;

      const res = await patch(
        `/projects/${projectId}/tasks/${taskId}`,
        member.token,
        { status: 'done' },
      );
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
      expect(res.body.title).toBe('Full task');
      expect(res.body.description).toBe('keep me');
      expect(res.body.priority).toBe('high');
      expect(res.body.due_date).toBe('2026-11-15');
      expect(res.body.assignee_id).toBe(member.id);
    });

    it('rejects an invalid status on update', async () => {
      const created = await post(`/projects/${projectId}/tasks`, member.token, {
        title: 'Status task',
        priority: 'low',
      });
      const res = await patch(
        `/projects/${projectId}/tasks/${created.body.id}`,
        member.token,
        { status: 'finished' },
      );
      expect(res.status).toBe(400);
    });

    it('does not let a member who is neither creator nor owner delete a task', async () => {
      // The owner creates the task, so the member is neither its creator nor the owner.
      const created = await post(`/projects/${projectId}/tasks`, owner.token, {
        title: 'Owner task',
        priority: 'low',
      });
      const res = await del(
        `/projects/${projectId}/tasks/${created.body.id}`,
        member.token,
      );
      expect(res.status).toBe(403);
    });
  });
});