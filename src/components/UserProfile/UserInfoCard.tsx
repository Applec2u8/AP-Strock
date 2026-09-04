import { useState } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useUser } from "../../context/UserContext";
import { supabase } from "../../lib/supabase";

export default function UserInfoCard() {
  const { user, DataUser } = useUser();
  const { isOpen, openModal, closeModal } = useModal();

  const [fullname, setFullname] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleOpen = () => {
    setFullname(user?.fullname || "");
    setTel(user?.tel || "");
    setEmail(user?.email || "");
    setNewPassword("");
    setMsg(null);
    openModal();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      // Update public users table (name & phone)
      if (user?.id) {
        const { error: dbErr } = await supabase
          .from("users")
          .update({ fullname, tel })
          .eq("id", user.id);
        if (dbErr) throw dbErr;
      }

      // Update auth data (email and/or password if changed)
      const authUpdates: { email?: string; password?: string } = {};
      if (email && email !== user?.email) authUpdates.email = email;
      if (newPassword && newPassword.trim() !== "") authUpdates.password = newPassword.trim();

      if (Object.keys(authUpdates).length > 0) {
        const { error: authErr } = await supabase.auth.updateUser(authUpdates);
        if (authErr) throw authErr;
      }

      // Refresh context data
      await DataUser();
      setMsg({ type: "success", text: "ບັນທຶກສຳເລັດ!" });
      setTimeout(() => closeModal(), 1200);
    } catch (err: any) {
      setMsg({ type: "error", text: err?.message || "ເກີດຂໍ້ຜິດພາດ" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-5">
            ຂໍ້ມູນສ່ວນຕົວ
          </h4>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7">
            <div>
              <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">ຊື່-ນາມສະກຸນ</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">{user?.fullname || "-"}</p>
            </div>
            <div>
              <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">ອີເມລ</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">{user?.email || "-"}</p>
            </div>
            <div>
              <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">ເບີໂທ</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">{user?.tel || "-"}</p>
            </div>
            <div>
              <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Role</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">{user?.role || "ຜູ້ໃຊ້ງານ"}</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpen}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
        >
          <svg className="fill-current" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206Z" fill="" />
          </svg>
          ແກ້ໄຂ
        </button>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[500px] m-4">
        <div className="no-scrollbar relative w-full max-w-[500px] overflow-y-auto rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-10">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">ແກ້ໄຂຂໍ້ມູນ</h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">ອັບເດດຂໍ້ມູນສ່ວນຕົວຂອງທ່ານ</p>

          {msg && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${msg.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSave} className="flex flex-col gap-5">
            <div>
              <Label>ຊື່-ນາມສະກຸນ</Label>
              <Input
                type="text"
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                placeholder="ຊື່ຂອງທ່ານ"
              />
            </div>
            <div>
              <Label>ອີເມລ</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label>ເບີໂທ</Label>
              <Input
                type="text"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                placeholder="020xxxxxxxx"
              />
            </div>
            <div>
              <Label>ລະຫັດຜ່ານໃໝ່ <span className="text-gray-400 text-xs font-normal">(ເວັ້ນຫວ່າງຖ້າບໍ່ຕ້ອງການປ່ຽນ)</span></Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center gap-3 mt-2 justify-end">
              <Button size="sm" variant="outline" onClick={closeModal} type="button">
                ປິດ
              </Button>
              <Button size="sm" type="submit" disabled={saving}>
                {saving ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
