import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { User, Profile, UserRole, AuthState } from '@/types/auth';
import { logError } from '@/lib/logger';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapProfileToUser(profile: Profile, role: UserRole): User {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.full_name,
    role: role,
    employeeType: profile.employee_type,
    department: profile.department || 'Unassigned',
    employeeId: profile.employee_id || profile.id.slice(0, 8).toUpperCase(),
    joiningDate: profile.joining_date || profile.created_at,
    avatar: profile.avatar_url || undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      console.log('[Auth] fetchUserData called for', userId);
      console.log('[Auth] fetchUserData called for', userId);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        logError('AuthContext.fetchProfile', profileError);
        return false;
      }

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        logError('AuthContext.fetchRole', roleError);
      }

      const userRole = (roleData?.role as UserRole) || 'employee';
      
      if (profileData) {
        // Block archived (soft-deleted) employees from accessing the app
        if ((profileData as any).deleted_at) {
          await supabase.auth.signOut();
          setProfile(null);
          setRole(null);
          setUser(null);
          const { toast } = await import('sonner');
          toast.error('This account has been archived. Contact an admin.');
          return false;
        }
        setProfile(profileData as Profile);
        setRole(userRole);
        setUser(mapProfileToUser(profileData as Profile, userRole));
        return true;
      }

      setProfile(null);
      setRole(null);
      setUser(null);
      return false;
    } catch (error) {
      logError('AuthContext.fetchUserData', error);
      setProfile(null);
      setRole(null);
      setUser(null);
      return false;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        
        if (session?.user) {
          fetchUserData(session.user.id).then(() => {
            setIsLoading(false);
          });
        } else {
          setProfile(null);
          setRole(null);
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setIsLoading(true);
        await fetchUserData(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchUserData(session.user.id);
    }
  };

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signup = async (email: string, password: string, fullName: string): Promise<{ error: string | null }> => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: fullName, employee_type: 'offline' },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          return { error: 'This email is already registered. Please sign in instead.' };
        }
        return { error: error.message };
      }
      return { error: null };
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setRole(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user, profile, role,
    isAuthenticated: !!session && !!user,
    isLoading, login, signup, logout, refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
