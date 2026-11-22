import { buildOrganizationInvitationEmail } from './organization-invitation.template';
import type { OrganizationInvitationProps } from '../types';

describe('buildOrganizationInvitationEmail', () => {
  const defaultProps: OrganizationInvitationProps = {
    inviterName: 'Budi Santoso',
    organizationName: 'organization Aqua Sejahtera',
    organizationLogo: '/logo/organization.png',
    role: 'organization_admin',
    inviteUrl: 'https://example.com/accept-invite?token=xyz123',
    appName: 'MyApp',
    baseUrl: 'https://example.com',
  };

  it('should generate organization invitation email layout with correct HTML structure and title', () => {
    const html = buildOrganizationInvitationEmail(defaultProps);

    expect(html).toContain(
      '<title>Undangan Bergabung - organization Aqua Sejahtera</title>',
    );
    expect(html).toContain('Undangan Bergabung');
    expect(html).toContain('Halo,');
    expect(html).toContain(
      'Budi Santoso mengundang Anda untuk bergabung dengan organisasi &quot;organization Aqua Sejahtera&quot; di MyApp sebagai Organization Admin.',
    );
    expect(html).toContain(
      'href="https://example.com/accept-invite?token=xyz123"',
    );
    expect(html).toContain('Terima Undangan');
  });

  it('should resolve absolute logo URL when relative logo path is provided', () => {
    const html = buildOrganizationInvitationEmail(defaultProps);
    expect(html).toContain('src="https://example.com/logo/organization.png"');
  });

  it('should preserve absolute logo URL if already full HTTP/HTTPS URL', () => {
    const propsWithFullLogoUrl: OrganizationInvitationProps = {
      ...defaultProps,
      organizationLogo: 'https://cdn.example.com/logos/organization.png',
    };
    const html = buildOrganizationInvitationEmail(propsWithFullLogoUrl);
    expect(html).toContain(
      'src="https://cdn.example.com/logos/organization.png"',
    );
  });

  it('should handle undefined or null organizationLogo gracefully', () => {
    const propsWithoutLogo: OrganizationInvitationProps = {
      ...defaultProps,
      organizationLogo: null,
    };
    const html = buildOrganizationInvitationEmail(propsWithoutLogo);
    expect(html).not.toContain('<img');
    expect(html).toContain('organization Aqua Sejahtera');
  });

  it('should humanize roles correctly in invitation text', () => {
    const propsWithRole: OrganizationInvitationProps = {
      ...defaultProps,
      role: 'organization-manager',
    };
    const html = buildOrganizationInvitationEmail(propsWithRole);
    expect(html).toContain('sebagai Organization Manager.');
  });

  it('should set header displayName to organizationName and logoUrl to resolved logo', () => {
    const html = buildOrganizationInvitationEmail(defaultProps);
    expect(html).toContain('organization Aqua Sejahtera');
  });

  it('should set footer senderName as "${organizationName} via ${appName}"', () => {
    const html = buildOrganizationInvitationEmail(defaultProps);
    expect(html).toContain('organization Aqua Sejahtera via MyApp');
  });

  it('should escape HTML sensitive characters in props to prevent XSS', () => {
    const maliciousProps: OrganizationInvitationProps = {
      inviterName: '<script>alert("inviter")</script>',
      organizationName: '<b>Hack & Corp</b>',
      organizationLogo: null,
      role: '<img src=x onerror=alert(1)>',
      inviteUrl: 'https://example.com/accept-invite?token=safe',
      appName: 'Acme & Co',
      baseUrl: 'https://example.com',
    };

    const html = buildOrganizationInvitationEmail(maliciousProps);

    expect(html).not.toContain('<script>alert("inviter")</script>');
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;inviter&quot;)&lt;/script&gt;',
    );

    expect(html).not.toContain('<b>Hack & Corp</b>');
    expect(html).toContain('&lt;b&gt;Hack &amp; Corp&lt;/b&gt;');

    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('Acme &amp; Co');
  });

  // Fallback for empty organizationName. The builder normalizes the name to
  // 'Organisasi' so the branding copy, title, header and footer stay
  // consistent when callers forget to provide a value.
  it('should fall back to "Organisasi" when organizationName is empty', () => {
    const props: OrganizationInvitationProps = {
      ...defaultProps,
      organizationName: '',
    };
    const html = buildOrganizationInvitationEmail(props);
    expect(html).toContain('<title>Undangan Bergabung - Organisasi</title>');
    expect(html).toContain('organisasi &quot;Organisasi&quot;');
    expect(html).toContain('Email otomatis dari Organisasi via MyApp');
    expect(html).toContain('alt="Organisasi"');
  });

  it('should fall back to "Organisasi" when organizationName is undefined', () => {
    const props = {
      ...defaultProps,
      organizationName: undefined as unknown as string,
    };
    const html = buildOrganizationInvitationEmail(props);
    expect(html).toContain('organisasi &quot;Organisasi&quot;');
  });

  // Logo URL safety: if the resolved logo URL is unsafe (or baseUrl is
  // missing for a relative path), no <img> tag is rendered.
  it('should omit logo when baseUrl is empty/undefined for a relative path', () => {
    const props: OrganizationInvitationProps = {
      ...defaultProps,
      baseUrl: '',
    };
    const html = buildOrganizationInvitationEmail(props);
    expect(html).not.toContain('<img');
  });

  it('should omit logo when baseUrl is unsafe', () => {
    const props: OrganizationInvitationProps = {
      ...defaultProps,
      baseUrl: 'javascript:alert(1)',
    };
    const html = buildOrganizationInvitationEmail(props);
    expect(html).not.toContain('<img');
  });

  it('should omit logo when organizationLogo is unsafe absolute URL', () => {
    const props: OrganizationInvitationProps = {
      ...defaultProps,
      organizationLogo: 'javascript:alert(1)',
    };
    const html = buildOrganizationInvitationEmail(props);
    expect(html).not.toContain('src="javascript:');
  });

  it('should match snapshot with deterministic year=2024', () => {
    const html = buildOrganizationInvitationEmail(defaultProps, { year: 2024 });
    expect(html).toContain('© 2024 MyApp');
    expect(html).toMatchSnapshot();
  });
});
