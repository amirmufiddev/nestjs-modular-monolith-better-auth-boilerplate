import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { RealtimeChannel, RealtimeEvent } from './sse.constants';
import { AppLoggerService } from '@/logger/logger.service';

@Injectable()
export class SseService {
  private readonly userSubjects = new Map<string, Subject<RealtimeEvent>>();
  private readonly organizationAdmins = new Map<string, Set<string>>();

  constructor(private readonly logger: AppLoggerService) {}

  subscribe(channel: RealtimeChannel): Observable<RealtimeEvent> {
    const parts = channel.split(':');
    const type = parts[0];

    let subject = this.userSubjects.get(channel);
    if (!subject) {
      subject = new Subject<RealtimeEvent>();
      this.userSubjects.set(channel, subject);

      if (type === 'admin') {
        const organizationId = this.extractOrganizationIdFromChannel(channel);
        if (organizationId) {
          if (!this.organizationAdmins.has(organizationId)) {
            this.organizationAdmins.set(organizationId, new Set());
          }
          this.organizationAdmins.get(organizationId)!.add(channel);
        }
      }
    }
    return subject.asObservable();
  }

  publishToChannel(channel: RealtimeChannel, event: RealtimeEvent): void {
    const subject = this.userSubjects.get(channel);
    if (subject) {
      subject.next(event);
    } else {
      this.logger.debug(
        `No active subscriber for channel ${channel}, dropping event ${event.type}`,
      );
    }
  }

  publishToOrganizationAdmins(
    organizationId: string,
    event: RealtimeEvent,
  ): void {
    const admins = this.organizationAdmins.get(organizationId);
    if (!admins || admins.size === 0) {
      this.logger.debug(
        `No active admin subscribers for organization ${organizationId}, dropping event ${event.type}`,
      );
      return;
    }
    admins.forEach((channel) => {
      const subject = this.userSubjects.get(channel);
      subject?.next(event);
    });
  }

  unsubscribe(channel: RealtimeChannel): void {
    const subject = this.userSubjects.get(channel);
    if (subject) {
      subject.complete();
      this.userSubjects.delete(channel);

      this.organizationAdmins.forEach((admins, organizationId) => {
        if (admins.has(channel)) {
          admins.delete(channel);
          if (admins.size === 0) this.organizationAdmins.delete(organizationId);
        }
      });
    }
  }

  getActiveConnectionCount(): number {
    return this.userSubjects.size;
  }

  private extractOrganizationIdFromChannel(channel: string): string | null {
    const parts = channel.split(':');
    // Channel format: "admin:userId:organizationId" or "org:organizationId:admin"
    if (parts.length < 3) {
      return null;
    }

    const channelType = parts[0];
    if (channelType === 'admin' && parts[2]) {
      return parts[2];
    }
    if (channelType === 'org' && parts[1]) {
      return parts[1];
    }

    return null;
  }
}
