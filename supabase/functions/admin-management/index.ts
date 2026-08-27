import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateTempPassword(length: number = 12): string {
  const lowercase = "abcdefghijkmnpqrstuvwxyz";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const special = "!@#$%";
  const all = lowercase + uppercase + numbers + special;
  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

async function countActiveMasterAdmins(adminClient: any): Promise<number> {
  const { count, error } = await adminClient
    .from("admin_users")
    .select("*", { count: "exact", head: true })
    .eq("role", "master_admin")
    .eq("is_active", true);
  if (error) return 0;
  return count || 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userToken = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminUserId = userData.user.id;
    const adminEmail = userData.user.email || "";

    // Check if caller is admin
    const { data: adminRecord } = await userClient
      .from("admin_users")
      .select("is_active, role")
      .eq("user_id", adminUserId)
      .maybeSingle();

    if (!adminRecord || !adminRecord.is_active) {
      return new Response(JSON.stringify({ error: "Not an admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isMasterAdmin = adminRecord.role === "master_admin";

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    const { action } = body;

    let responseData: Record<string, any> = {};

    // Actions that require master_admin
    const masterOnlyActions = [
      "list_admins", "create_admin", "create_master_admin",
      "update_admin", "update_master_admin", "revoke_admin",
      "send_password_reset", "force_reset_master_admin",
      "list_audit_log",
    ];

    if (masterOnlyActions.includes(action) && !isMasterAdmin) {
      return new Response(JSON.stringify({ error: "403 Forbidden: Only MASTER_ADMIN can manage admin accounts" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "list_admins": {
        const { data: admins, error } = await adminClient
          .from("admin_users")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) {
          return new Response(JSON.stringify({ error: "Failed to list admins" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        responseData = { admins: admins || [] };
        break;
      }

      case "list_audit_log": {
        const { data: logs, error } = await adminClient
          .from("admin_audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          return new Response(JSON.stringify({ error: "Failed to list audit log" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        responseData = { logs: logs || [] };
        break;
      }

      case "create_admin": {
        const { name, email, phone } = body;

        if (!email || !name) {
          return new Response(JSON.stringify({ error: "Name and email required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const tempPassword = generateTempPassword(12);

        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          user_metadata: { name, phone: phone || "" },
          app_metadata: { must_change_password: true },
          email_confirm: true,
        });

        if (createError) {
          return new Response(JSON.stringify({ error: `Failed to create user: ${createError.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: adminInsertError } = await adminClient
          .from("admin_users")
          .insert({
            user_id: newUser.user.id,
            email,
            is_active: true,
            role: "admin",
          });

        if (adminInsertError) {
          await adminClient.auth.admin.deleteUser(newUser.user.id);
          return new Response(JSON.stringify({ error: `Failed to create admin record: ${adminInsertError.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient.from("admin_audit_log").insert({
          admin_user_id: adminUserId,
          admin_email: adminEmail,
          target_user_id: newUser.user.id,
          target_email: email,
          action: "admin_created",
          details: { name, role: "admin" },
        });

        responseData = { temp_password: tempPassword, admin_id: newUser.user.id };
        break;
      }

      case "create_master_admin": {
        const { name, email, phone } = body;

        if (!email || !name) {
          return new Response(JSON.stringify({ error: "Name and email required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const tempPassword = generateTempPassword(12);

        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          user_metadata: { name, phone: phone || "" },
          app_metadata: { must_change_password: true },
          email_confirm: true,
        });

        if (createError) {
          return new Response(JSON.stringify({ error: `Failed to create user: ${createError.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: adminInsertError } = await adminClient
          .from("admin_users")
          .insert({
            user_id: newUser.user.id,
            email,
            is_active: true,
            role: "master_admin",
          });

        if (adminInsertError) {
          await adminClient.auth.admin.deleteUser(newUser.user.id);
          return new Response(JSON.stringify({ error: `Failed to create master admin record: ${adminInsertError.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient.from("admin_audit_log").insert({
          admin_user_id: adminUserId,
          admin_email: adminEmail,
          target_user_id: newUser.user.id,
          target_email: email,
          action: "master_admin_created",
          details: { name, role: "master_admin" },
        });

        responseData = { temp_password: tempPassword, admin_id: newUser.user.id };
        break;
      }

      case "update_admin": {
        const { admin_id, is_active } = body;

        const { data: targetAdmin } = await adminClient
          .from("admin_users")
          .select("role, email")
          .eq("id", admin_id)
          .maybeSingle();

        if (!targetAdmin) {
          return new Response(JSON.stringify({ error: "Admin not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (targetAdmin.role === "master_admin") {
          return new Response(JSON.stringify({ error: "Use update_master_admin for master admin accounts" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const updateData: any = {};
        if (typeof is_active === "boolean") updateData.is_active = is_active;

        const { error } = await adminClient
          .from("admin_users")
          .update(updateData)
          .eq("id", admin_id);

        if (error) {
          return new Response(JSON.stringify({ error: "Failed to update admin" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient.from("admin_audit_log").insert({
          admin_user_id: adminUserId,
          admin_email: adminEmail,
          target_email: targetAdmin.email,
          action: is_active === false ? "admin_disabled" : "admin_enabled",
          details: updateData,
        });

        responseData = { updated: true };
        break;
      }

      case "update_master_admin": {
        const { admin_id, is_active, name, phone } = body;

        const { data: targetAdmin } = await adminClient
          .from("admin_users")
          .select("role, email, user_id, is_active")
          .eq("id", admin_id)
          .maybeSingle();

        if (!targetAdmin) {
          return new Response(JSON.stringify({ error: "Admin not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (targetAdmin.role !== "master_admin") {
          return new Response(JSON.stringify({ error: "Use update_admin for regular admin accounts" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Last active master admin protection: cannot disable self or last remaining
        if (is_active === false) {
          if (targetAdmin.user_id === adminUserId) {
            return new Response(JSON.stringify({ error: "You cannot disable your own master admin account" }), {
              status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const activeCount = await countActiveMasterAdmins(adminClient);
          if (activeCount <= 1) {
            return new Response(JSON.stringify({ error: "Cannot disable the last active MASTER_ADMIN. At least one must remain active." }), {
              status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        const updateData: any = {};
        if (typeof is_active === "boolean") updateData.is_active = is_active;

        const { error } = await adminClient
          .from("admin_users")
          .update(updateData)
          .eq("id", admin_id);

        if (error) {
          return new Response(JSON.stringify({ error: "Failed to update master admin" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update profile metadata if name/phone provided
        if (name || phone) {
          const meta: any = {};
          if (name) meta.name = name;
          if (phone !== undefined) meta.phone = phone;
          await adminClient.auth.admin.updateUserById(targetAdmin.user_id, {
            user_metadata: meta,
          });
        }

        await adminClient.from("admin_audit_log").insert({
          admin_user_id: adminUserId,
          admin_email: adminEmail,
          target_user_id: targetAdmin.user_id,
          target_email: targetAdmin.email,
          action: is_active === false ? "master_admin_disabled" : is_active === true ? "master_admin_enabled" : "master_admin_updated",
          details: { is_active, name },
        });

        responseData = { updated: true };
        break;
      }

      case "revoke_admin": {
        const { admin_id } = body;

        const { data: targetAdmin } = await adminClient
          .from("admin_users")
          .select("role, email, user_id")
          .eq("id", admin_id)
          .maybeSingle();

        if (!targetAdmin) {
          return new Response(JSON.stringify({ error: "Admin not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (targetAdmin.role === "master_admin") {
          return new Response(JSON.stringify({ error: "Cannot revoke MASTER_ADMIN access. Use disable instead." }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await adminClient
          .from("admin_users")
          .delete()
          .eq("id", admin_id);

        if (error) {
          return new Response(JSON.stringify({ error: "Failed to revoke admin access" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient.from("admin_audit_log").insert({
          admin_user_id: adminUserId,
          admin_email: adminEmail,
          target_user_id: targetAdmin.user_id,
          target_email: targetAdmin.email,
          action: "admin_revoked",
          details: {},
        });

        responseData = { revoked: true };
        break;
      }

      case "send_password_reset": {
        const { email } = body;

        if (!email) {
          return new Response(JSON.stringify({ error: "Email required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: targetAdmin } = await adminClient
          .from("admin_users")
          .select("role")
          .eq("email", email)
          .maybeSingle();

        if (targetAdmin?.role === "master_admin") {
          return new Response(JSON.stringify({ error: "Use force_reset_master_admin for master admin accounts" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: resetError } = await adminClient.auth.admin.generateRecoveryLink(email);
        if (resetError) {
          return new Response(JSON.stringify({ error: `Failed to send reset link: ${resetError.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient.from("admin_audit_log").insert({
          admin_user_id: adminUserId,
          admin_email: adminEmail,
          target_email: email,
          action: "password_reset_requested",
          details: {},
        });

        responseData = { sent: true };
        break;
      }

      case "force_reset_master_admin": {
        const { admin_id } = body;

        const { data: targetAdmin } = await adminClient
          .from("admin_users")
          .select("role, email, user_id")
          .eq("id", admin_id)
          .maybeSingle();

        if (!targetAdmin) {
          return new Response(JSON.stringify({ error: "Admin not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (targetAdmin.role !== "master_admin") {
          return new Response(JSON.stringify({ error: "Use send_password_reset for regular admin accounts" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Generate new temp password and force change on next login
        const tempPassword = generateTempPassword(12);

        const { error: updateError } = await adminClient.auth.admin.updateUserById(
          targetAdmin.user_id,
          {
            password: tempPassword,
            app_metadata: { must_change_password: true },
          }
        );

        if (updateError) {
          return new Response(JSON.stringify({ error: `Failed to reset password: ${updateError.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient.from("admin_audit_log").insert({
          admin_user_id: adminUserId,
          admin_email: adminEmail,
          target_user_id: targetAdmin.user_id,
          target_email: targetAdmin.email,
          action: "master_admin_password_reset",
          details: { forced: true },
        });

        responseData = { temp_password: tempPassword };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
