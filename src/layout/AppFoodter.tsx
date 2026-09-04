import { WhatsappV2, Instagram } from "../icons";
export default function AppFoodter() {
  return (
    <div>
      <footer className="bg-neutral-primary-soft">
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          <div className="sm:flex sm:items-center sm:justify-between">
            <span className="flex mt-4 justify-center sm:mt-0 dark:text-gray-400 text-gray-500">
              © 2026 Apple.2u8 All rights reserved.
            </span>
            <div className="flex mt-4 justify-center sm:mt-0 dark:text-gray-400 text-gray-500">
              <a
                href="https://web.facebook.com/kkop.gonc"
                className="text-body hover:text-heading"
                target="_blank"
              >
                <svg
                  className="w-5 h-5"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill-rule="evenodd"
                    d="M13.135 6H15V3h-1.865a4.147 4.147 0 0 0-4.142 4.142V9H7v3h2v9.938h3V12h2.021l.592-3H12V6.591A.6.6 0 0 1 12.592 6h.543Z"
                    clip-rule="evenodd"
                  />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/apple.psc"
                className="text-body hover:text-heading ms-5"
                target="_blank"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <span className="sr-only">Instagram page</span>
              <a
                href="https://wa.link/sgl0q5"
                className="text-body hover:text-heading ms-5"
                target="_blank"
              >
                <WhatsappV2 className="w-5 h-5" />
              </a>
              <span className="sr-only">WhatsApp page</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
