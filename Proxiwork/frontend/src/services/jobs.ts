import { supabase } from '../lib/supabase'
export type Job={id:string;title:string;description:string;employment_type:string;suburb:string;state:string;employers:{company_name:string}[]|null}
export async function jobs(){if(!supabase)throw new Error('Supabase is not configured. Add frontend/.env.local.');const {data,error}=await supabase.from('jobs').select('id,title,description,employment_type,suburb,state,employers(company_name)').eq('status','published').order('created_at',{ascending:false});if(error)throw error;return data as Job[]}
export async function action(job_id:string,action:'saved'|'dismissed'){if(!supabase)throw new Error('Supabase is not configured.');const {error}=await supabase.from('saved_jobs').upsert({job_id,action},{onConflict:'user_id,job_id'});if(error)throw error}
export async function apply(job_id:string){if(!supabase)throw new Error('Supabase is not configured.');const {error}=await supabase.from('applications').insert({job_id});if(error)throw error}
