import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  createMulterConfig,
  resolveUploadedFile,
} from '../common/upload/multer.config';
import { BannerService } from './banner.service';
import {
  CreateBannerDto,
  UpdateBannerDto,
  ReorderBannersDto,
} from './dto/banner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ModuleName, PermissionAction, StaffStatus } from '@prisma/client';

@Controller('banners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Public()
  @Get('active')
  findActive() {
    return this.bannerService.findActive();
  }

  @Get()
  @RequirePermission({
    module: ModuleName.PROMOTIONAL_BANNER,
    action: PermissionAction.READ,
  })
  findAll(
    @Query('status') status?: StaffStatus,
    @Query('search') search?: string,
  ) {
    return this.bannerService.findAll({ status, search });
  }

  @Get(':id')
  @RequirePermission({
    module: ModuleName.PROMOTIONAL_BANNER,
    action: PermissionAction.READ,
  })
  findOne(@Param('id') id: string) {
    return this.bannerService.findOne(id);
  }

  @Post()
  @RequirePermission({
    module: ModuleName.PROMOTIONAL_BANNER,
    action: PermissionAction.CREATE,
  })
  @UseInterceptors(FileInterceptor('image', createMulterConfig('banners')))
  async create(
    @Body() createBannerDto: CreateBannerDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      createBannerDto.imageUrl =
        (await resolveUploadedFile(file, 'banners')) ||
        `/uploads/banners/${file.filename}`;
    }
    if (!createBannerDto.imageUrl || !createBannerDto.imageUrl.trim()) {
      throw new BadRequestException('Banner image is required');
    }
    return this.bannerService.create(createBannerDto);
  }

  @Patch('reorder')
  @RequirePermission({
    module: ModuleName.PROMOTIONAL_BANNER,
    action: PermissionAction.UPDATE,
  })
  reorder(@Body() reorderDto: ReorderBannersDto) {
    return this.bannerService.reorder(reorderDto);
  }

  @Patch(':id')
  @RequirePermission({
    module: ModuleName.PROMOTIONAL_BANNER,
    action: PermissionAction.UPDATE,
  })
  @UseInterceptors(FileInterceptor('image', createMulterConfig('banners')))
  async update(
    @Param('id') id: string,
    @Body() updateBannerDto: UpdateBannerDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      updateBannerDto.imageUrl =
        (await resolveUploadedFile(file, 'banners')) ||
        `/uploads/banners/${file.filename}`;
    }
    return this.bannerService.update(id, updateBannerDto);
  }

  @Delete(':id')
  @RequirePermission({
    module: ModuleName.PROMOTIONAL_BANNER,
    action: PermissionAction.DELETE,
  })
  remove(@Param('id') id: string) {
    return this.bannerService.remove(id);
  }
}
