import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

const AI_MODEL = 'openai/gpt-oss-120b';

async function authenticateAndAuthorize(req: Request, allowedRoles = ['caregiver', 'supervisor', 'admin_hr']) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error("401: Unauthorized - Bearer token missing");
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const supabaseUrl = Deno.env.get('SUPABASE_PROJECT_URL') || Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !user) {
    throw new Error("401: Unauthorized - Invalid JWT token");
  }

  // Fetch verified profile from database (staff_profiles)
  const { data: profile } = await adminClient
    .from('staff_profiles')
    .select('id, full_name, role, facility_id, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  const role = profile?.role || user.user_metadata?.role || 'caregiver';
  const facilityId = profile?.facility_id || 'FAC-001';

  if (profile && profile.is_active === false) {
    throw new Error("403: Forbidden - Verified staff profile is deactivated in database.");
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    throw new Error(`403: Forbidden - Role '${role}' is not authorized for Handover Contract`);
  }

  return { user, role, facilityId, adminClient };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    await authenticateAndAuthorize(req, ['caregiver', 'supervisor', 'admin_hr']);

    const { contract, outgoingStaff, incomingStaff, openObligations } = await req.json();
    const groqToken = Deno.env.get('Groq_Token') || Deno.env.get('GROQ_API_KEY') || Deno.env.get('VITE_GROQ_API_KEY');

    if (!groqToken) throw new Error("Groq API Token missing in environment");

    const systemPrompt = `Anda Handover Contract Agent. Validasi serah terima shift dua sisi padat & akurat. Output JSON ONLY: {"summaryAnalysis":string,"riskLevel":"LOW"|"MEDIUM"|"HIGH","criticalNotes":[string],"isValidated":boolean}`;

    const minifiedInput = JSON.stringify({
      shift: contract?.shift_name,
      giver: outgoingStaff?.full_name || 'Penyerah',
      receiver: incomingStaff?.full_name || 'Penerima',
      obs: (openObligations || []).map((o: any) => o.title || o)
    });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: AI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: minifiedInput }
        ],
        temperature: 0.2,
        max_tokens: 180
      })
    });

    if (!response.ok) {
      const errTxt = await response.text();
      throw new Error(`Handover Contract Failed: ${response.status} - ${errTxt}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    const isAuthError = error.message?.startsWith('401') || error.message?.startsWith('403');
    const statusCode = isAuthError ? parseInt(error.message.substring(0, 3)) : 400;

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode,
    });
  }
});
