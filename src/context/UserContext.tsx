import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface Workspace {
    owner_id: string;
    name: string;
    is_mine: boolean;
}

interface User {
    id?: string;
    email?: string;
    fullname?: string;
    tel?: string;
    active_workspace_id?: string | null;
    [key: string]: any;
}

interface UserContextType {
    user: User | null;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;
    DataUser: () => Promise<void>;
    workspaces: Workspace[];
    switchWorkspace: (workspaceId: string | null) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {

    const [user, setUser] = useState<User | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

    const fetchWorkspaces = async (userId: string) => {
        try {
            // Fetch teams the user is part of
            const { data: teams, error } = await supabase
                .from("teams")
                .select("*");

            if (error) throw error;

            const wsList: Workspace[] = [];
            // Add user's own workspace
            wsList.push({
                owner_id: userId,
                name: "ພື້ນທີ່ສ່ວນຕົວ (Personal)",
                is_mine: true
            });

            if (teams) {
                teams.forEach(t => {
                    // If team owner is NOT me, add it as a team workspace
                    if (t.owner_id !== userId) {
                        wsList.push({
                            owner_id: t.owner_id,
                            name: `ທີມ: ${t.name}`,
                            is_mine: false
                        });
                    }
                });
            }
            setWorkspaces(wsList);
        } catch (err) {
            console.error("Failed to fetch workspaces:", err);
        }
    };

    const DataUser = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                const { data, error } = await supabase
                    .from("users")
                    .select("*")
                    .eq("auth_id", session.user.id)
                    .maybeSingle();

                if (error) {
                    console.warn("Could not fetch user profile:", error.message);
                    setUser({ email: session.user.email, auth_user: session.user });
                } else if (data) {
                    setUser({ ...data, auth_user: session.user });
                    await fetchWorkspaces(data.id);
                } else {
                    setUser({ email: session.user.email, auth_user: session.user });
                }
            } else {
                setUser(null);
                setWorkspaces([]);
            }
        } catch (error) {
            console.error("Failed to fetch user data:", error);
            setUser(null);
            setWorkspaces([]);
        }
    }, []);

    const switchWorkspace = async (workspaceId: string | null) => {
        if (!user?.id) return;

        try {
            const { error } = await supabase
                .from("users")
                .update({ active_workspace_id: workspaceId })
                .eq("id", user.id);

            if (error) throw error;

            // Update local state and refresh the page to clear contexts/hooks
            setUser(prev => prev ? { ...prev, active_workspace_id: workspaceId } : null);
            window.location.reload();
        } catch (err) {
            console.error("Failed to switch workspace:", err);
            alert("ເກີດຂໍ້ຜິດພາດໃນການສັບປ່ຽນ Workspace");
        }
    };

    useEffect(() => {
        DataUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                DataUser();
            } else {
                setUser(null);
                setWorkspaces([]);
            }
        });

        return () => subscription.unsubscribe();
    }, [DataUser]);

    return (
        <UserContext.Provider value={{ user, setUser, DataUser, workspaces, switchWorkspace }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const ctx = useContext(UserContext);
    if (!ctx) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return ctx;
};
