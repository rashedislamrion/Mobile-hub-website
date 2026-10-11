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
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductService } from './product.service';
import { CreateProductDto, ProductFlagsDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ModuleName, PermissionAction, ProductStatus } from '@prisma/client';
import { createMulterConfig } from '../common/upload/multer.config';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Public()
  @Get()
  findAllPublic(
    @Query('category') category?: string,
    @Query('brand') brand?: string,
    @Query('color') color?: string,
    @Query('quality') quality?: string,
    @Query('guarantee') guarantee?: string,
    @Query('frame') frame?: string,
    @Query('type') type?: string,
    @Query('service') service?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('featured') featured?: string,
    @Query('bestDeal') bestDeal?: string,
    @Query('homepage') homepage?: string,
    @Query('newest') newest?: string,
    @Query('productCategory') productCategory?: string,
  ) {
    return this.productService.findAllPublic({
      category,
      brand,
      color,
      quality,
      guarantee,
      frame,
      type,
      service,
      sort,
      page,
      limit,
      search,
      featured,
      bestDeal,
      homepage,
      newest,
      productCategory,
    });
  }

  @RequirePermission({
    module: ModuleName.PRODUCTS,
    action: PermissionAction.READ,
  })
  @Get('pos-search')
  posSearch(
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('branch') branch?: string,
    @Query('branchId') branchId?: string,
    @Query('inStock') inStock?: string,
    @Query('limit') limit?: number,
  ) {
    return this.productService.posSearch(
      {
        search,
        category,
        branch: branchId || branch,
        branchId: branchId || branch,
        inStock,
        limit,
      },
      user,
    );
  }

  @RequirePermission({
    module: ModuleName.PRODUCTS,
    action: PermissionAction.READ,
  })
  @Get('admin')
  findAllAdmin(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: ProductStatus,
    @Query('homepage') homepage?: string,
    @Query('newest') newest?: string,
    @Query('featured') featured?: string,
    @Query('bestDeal') bestDeal?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productService.findAllAdmin({
      search,
      categoryId,
      brandId,
      branchId,
      status,
      homepage,
      newest,
      featured,
      bestDeal,
      sort,
      page,
      limit,
    });
  }

  @Public()
  @Get('categories')
  getCategories() {
    return this.productService.getCategoriesTree();
  }

  @Public()
  @Get('brands')
  getBrands() {
    return this.productService.getBrands();
  }

  @Public()
  @Get('series')
  getSeries(@Query('brandId') brandId?: string) {
    return this.productService.getSeries(brandId);
  }

  @Public()
  @Get('units')
  getUnits() {
    return this.productService.getUnits();
  }

  @Public()
  @Get('attributes')
  getAttributes() {
    return this.productService.getAttributes();
  }

  @RequirePermission({
    module: ModuleName.PRODUCTS,
    action: PermissionAction.UPDATE,
  })
  @Patch(':id/flags')
  updateFlags(@Param('id') id: string, @Body() dto: ProductFlagsDto) {
    return this.productService.updateFlags(id, dto);
  }

  @RequirePermission({
    module: ModuleName.PRODUCTS,
    action: PermissionAction.UPDATE,
  })
  @Patch(':id/toggle')
  toggleFlag(@Param('id') id: string, @Body() dto: ProductFlagsDto) {
    return this.productService.updateFlags(id, dto);
  }

  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.productService.findBySlug(slug);
  }

  @RequirePermission({
    module: ModuleName.PRODUCTS,
    action: PermissionAction.CREATE,
  })
  @Post()
  @UseInterceptors(
    FilesInterceptor('images', 10, createMulterConfig('products')),
  )
  create(
    @Body() dto: CreateProductDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.productService.create(dto, files);
  }

  @RequirePermission({
    module: ModuleName.PRODUCTS,
    action: PermissionAction.UPDATE,
  })
  @Patch(':id')
  @UseInterceptors(
    FilesInterceptor('images', 10, createMulterConfig('products')),
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.productService.update(id, dto, files);
  }

  @RequirePermission({
    module: ModuleName.PRODUCTS,
    action: PermissionAction.DELETE,
  })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
