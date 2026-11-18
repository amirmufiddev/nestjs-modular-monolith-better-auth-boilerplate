CREATE TABLE IF NOT EXISTS "rbac_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"action_display_name" text NOT NULL,
	"action_description" text,
	"resource_display_name" text NOT NULL,
	"resource_description" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rbac_permission_created_at_index" ON "rbac_permission" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rbac_permission_deleted_at_index" ON "rbac_permission" USING btree ("deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rbac_permission_resource" ON "rbac_permission" USING btree ("resource");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_rbac_permission_resource_action_active" ON "rbac_permission" USING btree ("resource","action") WHERE "rbac_permission"."deleted_at" is null;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rbac_role_template" (
	"role_name" text PRIMARY KEY NOT NULL,
	"permission" text NOT NULL,
	"permission_scopes" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "rbac_permission" (
	"resource", "action", "action_display_name", "resource_display_name", "resource_description"
)
SELECT v.resource, v.action, v.action_display_name, v.resource_display_name, v.resource_description
FROM (VALUES
	('member', 'read', 'Lihat Anggota', 'Anggota', 'Manajemen anggota organisasi'),
	('member', 'invite', 'Undang Anggota', 'Anggota', 'Manajemen anggota organisasi'),
	('member', 'remove', 'Hapus Anggota', 'Anggota', 'Manajemen anggota organisasi'),
	('member', 'update-role', 'Ubah Role Anggota', 'Anggota', 'Manajemen anggota organisasi'),
	('ac', 'create', 'Buat Role', 'Access Control', 'Manajemen roles dan permissions'),
	('ac', 'read', 'Lihat Roles', 'Access Control', 'Manajemen roles dan permissions'),
	('ac', 'update', 'Update Role', 'Access Control', 'Manajemen roles dan permissions'),
	('ac', 'delete', 'Hapus Role', 'Access Control', 'Manajemen roles dan permissions'),
	('broadcast', 'trigger', 'Trigger Manual Broadcast/Push', 'Broadcast', 'Push notification broadcast & FCM')
) AS v(resource, action, action_display_name, resource_display_name, resource_description)
WHERE NOT EXISTS (
	SELECT 1 FROM "rbac_permission" p
	WHERE p.resource = v.resource AND p.action = v.action AND p.deleted_at IS NULL
);
--> statement-breakpoint
INSERT INTO "rbac_role_template" ("role_name", "permission", "permission_scopes") VALUES
	('owner', '{"member":["read","invite","remove","update-role"],"ac":["create","read","update","delete"],"broadcast":["trigger"]}', '{"member:read":"organization","member:invite":"organization","member:remove":"organization","member:update-role":"organization","ac:create":"organization","ac:read":"organization","ac:update":"organization","ac:delete":"organization","broadcast:trigger":"organization"}'),
	('admin', '{"member":["read","invite","remove","update-role"],"ac":["read"],"broadcast":["trigger"]}', '{"member:read":"organization","member:invite":"organization","member:remove":"organization","member:update-role":"organization","ac:read":"organization","broadcast:trigger":"organization"}'),
	('member', '{"member":["read"]}', '{"member:read":"organization"}')
ON CONFLICT ("role_name") DO NOTHING;