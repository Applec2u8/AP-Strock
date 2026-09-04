import React, { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { supabase } from "../../lib/supabase";
import { useUser } from "../../context/UserContext";
import Button from "../../components/ui/button/Button";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { FormDrawer } from "../../components/ui/drawer/FormDrawer";

export default function TeamManagement() {
  const { user } = useUser();
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [myTeam, setMyTeam] = useState<any>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isInviteDrawerOpen, setIsInviteDrawerOpen] = useState(false);

  const [isOwner, setIsOwner] = useState(false);

  const fetchTeam = async () => {
    if (!user) return;

    // Use active workspace to determine which team to show
    const activeWsId = user.active_workspace_id || user.id;

    // Find ALL teams this user is part of (the RLS policy on teams handles this)
    // teams RLS: owner_id = me OR I am in team_members for that team
    const { data: allTeams } = await supabase
      .from("teams")
      .select("*");

    if (!allTeams || allTeams.length === 0) {
      setMyTeam(false);
      setIsOwner(false);
      return;
    }

    // Find the team corresponding to the active workspace
    const activeTeam = allTeams.find((t: any) => String(t.owner_id) === String(activeWsId)) || allTeams[0];

    setMyTeam(activeTeam);
    setIsOwner(String(activeTeam.owner_id) === String(user.id));

    // Fetch ALL members of this team
    const { data: members } = await supabase
      .from("team_members")
      .select(`role, user_id, users:user_id ( id, fullname, email )`)
      .eq("team_id", activeTeam.id);

    if (members) setTeamMembers(members);
  };

  useEffect(() => {
    fetchTeam();
  }, [user]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!inviteEmail) return;

    setLoading(true);

    try {
      const { data: foundUser, error: findError } = await supabase
        .from("users")
        .select("*")
        .eq("email", inviteEmail)
        .single();

      if (findError || !foundUser) {
        setMessage({ type: 'error', text: "ບໍ່ພົບຜູ້ໃຊ້ທີ່ມີອີເມລນີ້ໃນລະບົບ." });
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from("team_members")
        .insert({
          team_id: myTeam.id,
          user_id: foundUser.id,
          role: "member"
        });

      if (insertError) {
        if (insertError.code === "23505") {
          setMessage({ type: 'error', text: "ຜູ້ໃຊ້ນີ້ຢູ່ໃນທີມແລ້ວ." });
        } else {
          setMessage({ type: 'error', text: "ເກີດຂໍ້ຜິດພາດໃນການເພີ່ມເຂົ້າທີມ." });
        }
      } else {
        setMessage({ type: 'success', text: `ເພີ່ມ ${foundUser.fullname || inviteEmail} ເຂົ້າທີມສຳເລັດແລ້ວ!` });
        setInviteEmail("");
        fetchTeam();
        setIsInviteDrawerOpen(false);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: "ເກີດຂໍ້ຜິດພາດ." });
    }

    setLoading(false);
  };

  const handleRemove = async (userId: string) => {
    if (userId === user?.id) {
      setMessage({ type: 'error', text: "ທ່ານບໍ່ສາມາດລົບຕົວເອງອອກຈາກທີມໄດ້." });
      return;
    }

    if (confirm("ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລົບຜູ້ໃຊ້ນີ້ອອກຈາກທີມ?")) {
      // --- Optimistic Update ---
      const snapshot = teamMembers;
      setTeamMembers(prev => prev.filter(m => m.user_id !== userId));

      try {
        const { error } = await supabase
          .from("team_members")
          .delete()
          .eq("team_id", myTeam.id)
          .eq("user_id", userId);

        if (error) throw error;
        // Success
      } catch (err) {
        // --- Rollback ---
        setTeamMembers(snapshot);
        setMessage({ type: 'error', text: "ເກີດຂໍ້ຜິດພາດໃນການລົບອອກຈາກທີມ." });
        console.error(err);
      }
    }
  };


  return (
    <>
      <PageMeta
        title="ຈັດການທີມ | AP Stock"
        description="ໜ້າຈັດການສະມາຊິກໃນທີມ"
      />
      <PageBreadcrumb pageTitle="ຈັດການທີມ (Team Management)" />

      <div className="space-y-6">
        {/* Team Details */}
        <div className="p-6 bg-white border border-gray-200 rounded-2xl dark:bg-gray-800 dark:border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
                ທີມຂອງຂ້ອຍ: {myTeam === null ? "ກຳລັງໂຫຼດ..." : myTeam === false ? "ບໍ່ພົບທີມ" : myTeam.name}
              </h3>
              {myTeam && myTeam !== false && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ບົດບາດຂອງທ່ານ:
                  <span className={`ml-2 inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${isOwner ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {isOwner ? 'ເຈົ້າຂອງ (Owner)' : 'ສະມາຊິກ (Member)'}
                  </span>
                </p>
              )}
            </div>
            {isOwner && (
              <Button size="sm" onClick={() => { setMessage(null); setIsInviteDrawerOpen(true); }}>
                + ເຊີນສະມາຊິກ
              </Button>
            )}
          </div>

          {message && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              {message.text}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="text-gray-500 bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">ຊື່</th>
                  <th className="px-4 py-3 font-medium">ອີເມລ</th>
                  <th className="px-4 py-3 font-medium">ບົດບາດ (Role)</th>
                  <th className="px-4 py-3 font-medium text-right">ຈັດການ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {teamMembers.map((member) => (
                  <tr key={member.user_id}>
                    <td className="px-4 py-3 text-gray-800 dark:text-white/90">
                      {member.users?.fullname || "ບໍ່ລະບຸຊື່"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {member.users?.email}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${member.role === 'owner' ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {member.role === 'owner' ? 'ເຈົ້າຂອງ (Owner)' : 'ສະມາຊິກ (Member)'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemove(member.user_id)}
                          className="text-error-500 hover:text-error-600"
                        >
                          ລົບອອກ
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {teamMembers.length === 0 && myTeam !== null && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-500">ບໍ່ມີສະມາຊິກໃນທີມ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Invite Drawer ────────────────────────────────────── */}
      <FormDrawer
        isOpen={isInviteDrawerOpen}
        onClose={() => setIsInviteDrawerOpen(false)}
        title="ເພີ່ມສະມາຊິກເຂົ້າທີມ"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          {message && (
            <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              {message.text}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ອີເມລ (Email) <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              placeholder="user@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={loading || !myTeam}
              required
              autoFocus
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white dark:bg-white/[0.05] dark:border-white/[0.1] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              ກະລຸນາໃສ່ອີເມລຂອງຜູ້ໃຊ້ທີ່ມີຢູ່ໃນລະບົບແລ້ວ
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsInviteDrawerOpen(false)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
            >
              ຍົກເລີກ
            </button>
            <button
              type="submit"
              disabled={loading || !myTeam || !inviteEmail.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "ກຳລັງເພີ່ມ..." : "ເພີ່ມເຂົ້າທີມ"}
            </button>
          </div>
        </form>
      </FormDrawer>
    </>
  );
}
