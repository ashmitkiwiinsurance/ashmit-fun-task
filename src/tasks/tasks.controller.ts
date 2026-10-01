import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('projects/:projectId/tasks')
export class TasksController {
  private tasksService: TasksService;

  constructor(tasksService: TasksService) {
    this.tasksService = tasksService;
  }


  @Post()
  create(
    @Req() req: { user: { id: number } },
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: CreateTaskDto,
  ) {
    return this.tasksService.createTask(req.user.id, projectId, body);
  }


  @Get()
  list(
    @Req() req: { user: { id: number } },
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.tasksService.listTasks(req.user.id, projectId);
  }


  @Get(':taskId')
  getOne(
    @Req() req: { user: { id: number } },
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.tasksService.getTask(req.user.id, projectId, taskId);
  }


  @Patch(':taskId')
  update(
    @Req() req: { user: { id: number } },
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() body: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(req.user.id, projectId, taskId, body);
  }


  @Delete(':taskId')
  remove(
    @Req() req: { user: { id: number } },
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.tasksService.deleteTask(req.user.id, projectId, taskId);
  }
}
