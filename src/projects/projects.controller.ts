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

import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  private projectsService: ProjectsService;

  constructor(projectsService: ProjectsService) {
    this.projectsService = projectsService;
  }


  @Post()
  create(@Req() req: { user: { id: number } }, @Body() body: CreateProjectDto) {
    return this.projectsService.createProject(req.user.id, body);
  }


  @Get()
  list(@Req() req: { user: { id: number } }) {
    return this.projectsService.listProjects(req.user.id);
  }


  @Get(':id')
  getOne(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.projectsService.getProject(req.user.id, id);
  }


  @Patch(':id')
  update(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(req.user.id, id, body);
  }


  @Delete(':id')
  remove(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.projectsService.deleteProject(req.user.id, id);
  }


  @Post(':id/members')
  addMember(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AddMemberDto,
  ) {
    return this.projectsService.addMember(req.user.id, id, body);
  }


  @Get(':id/members')
  listMembers(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.projectsService.listMembers(req.user.id, id);
  }


  @Delete(':id/members/:memberId')
  removeMember(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    return this.projectsService.removeMember(req.user.id, id, memberId);
  }
}
