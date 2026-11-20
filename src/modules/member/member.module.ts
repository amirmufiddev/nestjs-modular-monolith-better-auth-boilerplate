import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { MemberController } from './controllers/member.controller';
import { MemberService } from './services/member.service';
import { MemberRepository } from './repositories/member.repository';
import { MemberAcceptedBridge } from './services/member-accepted.bridge';
import { MEMBER_REPOSITORY_TOKEN } from './interfaces/member-repository.interface';
import { RbacModule } from '../rbac';

@Module({
  imports: [DatabaseModule, RbacModule],
  controllers: [MemberController],
  providers: [
    MemberService,
    {
      provide: MEMBER_REPOSITORY_TOKEN,
      useClass: MemberRepository,
    },
  ],
  exports: [MemberService, MEMBER_REPOSITORY_TOKEN],
})
export class MemberModule implements OnModuleInit {
  constructor(private readonly memberService: MemberService) {}

  onModuleInit() {
    MemberAcceptedBridge.handler = (p) =>
      this.memberService.handleMemberAccepted(p);
  }
}
