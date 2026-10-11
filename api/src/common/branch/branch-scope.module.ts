import { Global, Module } from '@nestjs/common';
import { BranchScopeService } from './branch-scope.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [BranchScopeService],
  exports: [BranchScopeService],
})
export class BranchScopeModule {}
