import { Injectable } from "@nestjs/common";

export interface EmailVerificationDelivery {
  email: string;
  expiresAt: Date;
  tenantId: string;
  token: string;
  userId: string;
}

export interface PasswordResetDelivery {
  email: string;
  expiresAt: Date;
  tenantId: string;
  token: string;
  userId: string;
}

@Injectable()
export class AuthNotificationService {
  private readonly emailVerificationDeliveries: EmailVerificationDelivery[] = [];
  private readonly passwordResetDeliveries: PasswordResetDelivery[] = [];

  deliverEmailVerification(input: EmailVerificationDelivery): Promise<void> {
    this.emailVerificationDeliveries.push(input);

    return Promise.resolve();
  }

  deliverPasswordReset(input: PasswordResetDelivery): Promise<void> {
    this.passwordResetDeliveries.push(input);

    return Promise.resolve();
  }

  pullLatestEmailVerificationToken(email: string): string | null {
    const normalizedEmail = email.trim().toLowerCase();
    const delivery = [...this.emailVerificationDeliveries]
      .reverse()
      .find((item) => item.email.trim().toLowerCase() === normalizedEmail);

    return delivery?.token ?? null;
  }

  pullLatestPasswordResetToken(email: string): string | null {
    const normalizedEmail = email.trim().toLowerCase();
    const delivery = [...this.passwordResetDeliveries]
      .reverse()
      .find((item) => item.email.trim().toLowerCase() === normalizedEmail);

    return delivery?.token ?? null;
  }
}
