import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './category/category.module';
import { BrandModule } from './brand/brand.module';
import { SeriesModule } from './series/series.module';
import { UnitModule } from './unit/unit.module';
import { AttributeModule } from './attribute/attribute.module';
import { ProductModule } from './product/product.module';
import { BranchModule } from './branch/branch.module';
import { OrderModule } from './order/order.module';
import { ServiceJobModule } from './service-job/service-job.module';
import { ShipmentModule } from './shipment/shipment.module';
import { SalesReturnModule } from './sales-return/sales-return.module';
import { ExchangeModule } from './exchange/exchange.module';
import { DepartmentModule } from './department/department.module';
import { EmployeeModule } from './employee/employee.module';
import { RoleModule } from './role/role.module';
import { PayrollModule } from './payroll/payroll.module';
import { WalletModule } from './wallet/wallet.module';
import { ExpenseModule } from './expense/expense.module';
import { SupplierModule } from './supplier/supplier.module';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { ReportModule } from './report/report.module';
import { BannerModule } from './banner/banner.module';
import { AdModule } from './ad/ad.module';
import { PromoCodeModule } from './promo-code/promo-code.module';
import { PushNotificationModule } from './push-notification/push-notification.module';
import { BlogModule } from './blog/blog.module';
import { PageModule } from './page/page.module';
import { MenuModule } from './menu/menu.module';
import { FooterSettingsModule } from './footer-settings/footer-settings.module';
import { CountryModule } from './country/country.module';
import { SocialLinkModule } from './social-link/social-link.module';
import { ContactSubmissionModule } from './contact-submission/contact-submission.module';
import { TicketIssueTypeModule } from './ticket-issue-type/ticket-issue-type.module';
import { SupportTicketModule } from './support-ticket/support-ticket.module';
import { HelpNoteModule } from './help-note/help-note.module';
import { BusinessSettingsModule } from './business-settings/business-settings.module';
import { CurrencyModule } from './currency/currency.module';
import { DeliveryChargeModule } from './delivery-charge/delivery-charge.module';
import { ThirdPartyConfigModule } from './third-party-config/third-party-config.module';
import { PaymentModule } from './payment/payment.module';
import { StockAdjustmentModule } from './stock-adjustment/stock-adjustment.module';
import { WastedProductModule } from './wasted-product/wasted-product.module';
import { CustomerModule } from './customer/customer.module';
import { PosModule } from './pos/pos.module';
import { PhoneUnitModule } from './phone-unit/phone-unit.module';
import { ServiceLookupModule } from './service-lookup/service-lookup.module';
import { ProductRequestModule } from './product-request/product-request.module';
import { WantedProductModule } from './wanted-product/wanted-product.module';
import { BranchScopeModule } from './common/branch/branch-scope.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 1000,
      },
    ]),
    PrismaModule,
    BranchScopeModule,
    AuthModule,
    CategoryModule,
    BrandModule,
    SeriesModule,
    UnitModule,
    AttributeModule,
    ProductModule,
    BranchModule,
    OrderModule,
    ServiceJobModule,
    ShipmentModule,
    SalesReturnModule,
    ExchangeModule,
    DepartmentModule,
    EmployeeModule,
    RoleModule,
    PayrollModule,
    WalletModule,
    ExpenseModule,
    SupplierModule,
    PurchaseOrderModule,
    ReportModule,
    BannerModule,
    AdModule,
    PromoCodeModule,
    PushNotificationModule,
    BlogModule,
    PageModule,
    MenuModule,
    FooterSettingsModule,
    CountryModule,
    SocialLinkModule,
    ContactSubmissionModule,
    TicketIssueTypeModule,
    SupportTicketModule,
    HelpNoteModule,
    BusinessSettingsModule,
    CurrencyModule,
    DeliveryChargeModule,
    ThirdPartyConfigModule,
    PaymentModule,
    StockAdjustmentModule,
    WastedProductModule,
    CustomerModule,
    PosModule,
    PhoneUnitModule,
    ServiceLookupModule,
    ProductRequestModule,
    WantedProductModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
