import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CategoryService } from './category.service';
import {
  CreateCategoryDto,
  BulkDeleteCategoryDto,
} from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ModuleName, PermissionAction } from '@prisma/client';
import { createMulterConfig } from '../common/upload/multer.config';

@Controller(['categories', 'category'])
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Public()
  @Get('tree')
  getTree() {
    return this.categoryService.getTree();
  }

  @RequirePermission({
    module: ModuleName.CATEGORY,
    action: PermissionAction.READ,
  })
  @Get()
  findAll(@Query('parentId') parentId?: string) {
    return this.categoryService.findAll(parentId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  @RequirePermission({
    module: ModuleName.CATEGORY,
    action: PermissionAction.CREATE,
  })
  @Post()
  @UseInterceptors(FileInterceptor('image', createMulterConfig('categories')))
  create(
    @Body() dto: CreateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.categoryService.create(dto, file);
  }

  @RequirePermission({
    module: ModuleName.CATEGORY,
    action: PermissionAction.UPDATE,
  })
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', createMulterConfig('categories')))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.categoryService.update(id, dto, file);
  }

  @RequirePermission({
    module: ModuleName.CATEGORY,
    action: PermissionAction.DELETE,
  })
  @Delete('bulk')
  removeBulk(@Body() dto: BulkDeleteCategoryDto) {
    return this.categoryService.removeBulk(dto.ids);
  }

  @RequirePermission({
    module: ModuleName.CATEGORY,
    action: PermissionAction.DELETE,
  })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}
