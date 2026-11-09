import {createClient} from '@supabase/supabase-js';
const {NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key,ADMIN_EMAIL:email}=process.env;
if(!url||!key||!email)throw new Error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL securely.');
const db=createClient(url,key,{auth:{persistSession:false}});
const {error}=await db.rpc('provision_first_admin',{email_address:email});
if(error){console.error('First-admin provisioning rejected. Ensure this is a verified registered account and no admin exists.');process.exit(1);}
console.log('First administrator provisioned. Sign in normally.');
