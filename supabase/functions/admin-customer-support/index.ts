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

    const isMaster = adminRecord.role === "master_admin";

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    const { action, target_user_id, target_email } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Action required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetUserId = target_user_id;
    let targetEmail = target_email;

    // If we only have email, look up the user
    if (!targetUserId && targetEmail) {
      const { data: userList, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) {
        return new Response(JSON.stringify({ error: "Failed to look up user" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const found = userList.users.find((u: any) => u.email === targetEmail);
      if (!found) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetUserId = found.id;
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "Target user required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get target user email if not provided
    if (!targetEmail) {
      const { data: targetUser } = await adminClient.auth.admin.getUserById(targetUserId);
      targetEmail = targetUser?.user?.email || "";
    }

    let auditAction = action;
    let auditDetails: Record<string, any> = {};
    let responseData: Record<string, any> = {};

    switch (action) {
      case "set_temp_password": {
        if (!isMaster) {
          return new Response(JSON.stringify({ error: "Only MASTER_ADMIN can set temporary passwords" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const tempPassword = generateTempPassword(12);

        const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, {
          password: tempPassword,
        });

        if (updateError) {
          return new Response(JSON.stringify({ error: `Failed to set password: ${updateError.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Set must_change_password flag in raw_app_meta_data
        const { data: currentMeta } = await adminClient.auth.admin.getUserById(targetUserId);
        const existingAppMeta = currentMeta?.user?.app_metadata || {};
        await adminClient.auth.admin.updateUserById(targetUserId, {
          app_metadata: { ...existingAppMeta, must_change_password: false },
        });

        responseData = { temp_password: tempPassword };
        auditAction = "set_temp_password";
        auditDetails = { must_change_password: false };
        // NEVER store the temp password in audit details
        break;
      }

      case "send_reset_link": {
        if (!targetEmail) {
          return new Response(JSON.stringify({ error: "Customer email required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: resetError } = await adminClient.auth.admin.generateRecoveryLink(targetEmail);
        if (resetError) {
          return new Response(JSON.stringify({ error: `Failed to send reset link: ${resetError.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        responseData = { sent: true };
        auditAction = "send_reset_link";
        auditDetails = { email: targetEmail };
        break;
      }

      case "force_password_change": {
        const { data: currentMeta } = await adminClient.auth.admin.getUserById(targetUserId);
        const existingAppMeta = currentMeta?.user?.app_metadata || {};
        await adminClient.auth.admin.updateUserById(targetUserId, {
          app_metadata: { ...existingAppMeta, must_change_password: false },
        });

        responseData = { forced: true };
        auditAction = "force_password_change";
        auditDetails = {};
        break;
      }

      case "unlock_account": {
        // Clear ban by setting ban_duration to 'none' (Supabase Admin API)
        const { data: currentMeta2 } = await adminClient.auth.admin.getUserById(targetUserId);
        const existingAppMeta2 = currentMeta2?.user?.app_metadata || {};
        const { error: unlockError } = await adminClient.auth.admin.updateUserById(targetUserId, {
          ban_duration: "none",
          app_metadata: { ...existingAppMeta2, must_change_password: false, banned_until: undefined },
        });

        if (unlockError) {
          return new Response(JSON.stringify({ error: `Failed to unlock: ${unlockError.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        responseData = { unlocked: true };
        auditAction = "unlock_account";
        auditDetails = {};
        break;
      }

      case "get_customer_detail": {
        // Fetch user details
        const { data: targetUser, error: targetError } = await adminClient.auth.admin.getUserById(targetUserId);
        if (targetError) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch addresses
        const { data: addresses } = await adminClient
          .from("customer_addresses")
          .select("*")
          .eq("user_id", targetUserId)
          .order("created_at", { ascending: false });

        // Fetch orders
        const { data: orders } = await adminClient
          .from("orders")
          .select("*")
          .eq("user_id", targetUserId)
          .order("created_at", { ascending: false });

        // Fetch audit logs
        const { data: auditLogs } = await adminClient
          .from("admin_audit_log")
          .select("*")
          .eq("target_user_id", targetUserId)
          .order("created_at", { ascending: false })
          .limit(50);

        // Calculate totals
        const activeOrders = (orders || []).filter((o: any) => o.status !== "cancelled");
        const totalSpend = activeOrders.reduce((sum: number, o: any) => sum + Number(o.grand_total), 0);

        responseData = {
          user: {
            id: targetUser.user.id,
            email: targetUser.user.email,
            created_at: targetUser.user.created_at,
            last_sign_in_at: targetUser.user.last_sign_in_at,
            banned_until: (targetUser.user as any).banned_until || (targetUser.user.app_metadata as any)?.banned_until || null,
            app_metadata: targetUser.user.app_metadata || {},
            user_metadata: targetUser.user.user_metadata || {},
          },
          addresses: addresses || [],
          orders: orders || [],
          audit_logs: auditLogs || [],
          total_orders: (orders || []).length,
          total_spend: totalSpend,
          account_status: ((targetUser.user as any).banned_until || (targetUser.user.app_metadata as any)?.banned_until) ? "locked" : "active",
          must_change_password: (targetUser.user.app_metadata as any)?.must_change_password || false,
        };
        return new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Insert audit log (NEVER includes temp password)
    await adminClient.from("admin_audit_log").insert({
      admin_user_id: adminUserId,
      admin_email: adminEmail,
      target_user_id: targetUserId,
      target_email: targetEmail,
      action: auditAction,
      details: auditDetails,
    });

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
