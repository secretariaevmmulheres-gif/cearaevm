import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestUser {
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'editor' | 'viewer';
}

const testUsers: TestUser[] = [
  {
    email: 'marcio.bezerra@mulheres.ce.gov.br',
    password: 'Mulheres@2026',
    fullName: 'Márcio Bezerra',
    role: 'admin'
  },
  {
    email: 'editor@mulheres.ce.gov.br',
    password: 'Editor@2026',
    fullName: 'Editor de Teste',
    role: 'editor'
  },
  {
    email: 'viewer@mulheres.ce.gov.br',
    password: 'Viewer@2026',
    fullName: 'Visualizador de Teste',
    role: 'viewer'
  }
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const results: { email: string; role: string; status: string }[] = []

    for (const testUser of testUsers) {
      // Check if user exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === testUser.email)

      let userId: string

      if (existingUser) {
        userId = existingUser.id
        console.log('User already exists:', testUser.email)
        results.push({ email: testUser.email, role: testUser.role, status: 'already_exists' })
      } else {
        // Create user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: testUser.email,
          password: testUser.password,
          email_confirm: true,
          user_metadata: { full_name: testUser.fullName }
        })

        if (createError) {
          console.error('Error creating user:', testUser.email, createError)
          results.push({ email: testUser.email, role: testUser.role, status: `error: ${createError.message}` })
          continue
        }

        userId = newUser.user.id
        console.log('User created:', testUser.email)
        results.push({ email: testUser.email, role: testUser.role, status: 'created' })
      }

      // Check if user already has the role
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (!existingRole) {
        // Add role
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: userId, role: testUser.role })

        if (roleError) {
          console.error('Error adding role:', testUser.email, roleError)
        } else {
          console.log('Role added:', testUser.role, 'for', testUser.email)
        }
      } else if (existingRole.role !== testUser.role) {
        // Update role if different
        const { error: updateError } = await supabaseAdmin
          .from('user_roles')
          .update({ role: testUser.role })
          .eq('user_id', userId)

        if (updateError) {
          console.error('Error updating role:', testUser.email, updateError)
        } else {
          console.log('Role updated:', testUser.role, 'for', testUser.email)
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuários de teste configurados com sucesso',
        users: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
