import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
type Value={session:Session|null;loading:boolean;signOut:()=>Promise<void>}; const Context=createContext<Value|undefined>(undefined)
export function AuthProvider({children}:{children:React.ReactNode}){const [session,setSession]=useState<Session|null>(null);const [loading,setLoading]=useState(true);useEffect(()=>{if(!supabase){setLoading(false);return};void supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const {data}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setLoading(false)});return()=>data.subscription.unsubscribe()},[]);return <Context.Provider value={{session,loading,signOut:async()=>{if(supabase)await supabase.auth.signOut()}}}>{children}</Context.Provider>}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error('AuthProvider is required');return value}
