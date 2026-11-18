import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { MEMBER_API } from '../api/member.api';
import { MemberService } from '../application/member.service';
import { MemberFacade } from '../facade/member.facade';
import { MemberAcceptedBridge } from './member-accepted.bridge';
import { MemberRepository } from './member.repository';
import { MemberController } from '../presentation/member.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [MemberController],
  providers: [
    MemberRepository,
    MemberService,
    MemberFacade,
    {
      provide: MEMBER_API,
      useClass: MemberFacade,
    },
  ],
  exports: [MEMBER_API, MemberService, MemberRepository],
})
export class MemberModule implements OnModuleInit {
  constructor(private readonly memberService: MemberService) {}

  onModuleInit() {
    MemberAcceptedBridge.handler = (p) =>
      this.memberService.handleMemberAccepted(p);
  }
}
