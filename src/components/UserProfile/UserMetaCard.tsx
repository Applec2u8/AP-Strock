import { useUser } from "../../context/UserContext";

export default function UserMetaCard() {
  const { user } = useUser();

  return (
    <>
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
            {/* Avatar - initial letter */}
            <div className="w-20 h-20 overflow-hidden border-2 border-blue-500 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0">
              <span className="text-white text-3xl font-bold">
                {user?.fullname ? user.fullname.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>

            {/* Info */}
            <div className="order-3 xl:order-2 text-center xl:text-left">
              <h4 className="mb-1 text-xl font-bold text-gray-800 dark:text-white/90">
                {user?.fullname || 'ຍັງບໍ່ໄດ້ຕັ້ງຊື່'}
              </h4>
              <div className="flex flex-col items-center gap-1 xl:flex-row xl:gap-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {user?.email || '-'}
                </p>
                {user?.tel && (
                  <>
                    <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      📞 {user.tel}
                    </p>
                  </>
                )}
              </div>
              <div className="mt-2 flex justify-center xl:justify-start">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {user?.role || 'ຜູ້ໃຊ້ງານ'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
