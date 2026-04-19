import { FileTextIcon, GlobeIcon, HomeIcon, SearchIcon } from "lucide-react";
import { NavLink } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Links = [
  {
    to: "/dashboard/home",
    icon: <HomeIcon className="size-4" />,
    label: "Home",
  },
  {
    to: "/dashboard/documents",
    icon: <FileTextIcon className="size-4" />,
    label: "Documents",
  },
  {
    to: "/dashboard/sources",
    icon: <GlobeIcon className="size-4" />,
    label: "Sources",
  },
  {
    to: "/dashboard/research",
    icon: <SearchIcon className="size-4" />,
    label: "Research",
  },
];

export const SidebarNavigation = () => {
  return (
    <aside className="flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* <div className="px-4 py-4">
        <p className="font-heading text-xs uppercase tracking-widest">Dashboard</p>
      </div> */}
      {/* <Separator /> */}
      <nav className="flex flex-col gap-2 p-3">
        {Links.map((l) => (
          <NavLink
            key={l.to}
            className={({ isActive }) =>
              cn(
                buttonVariants({
                  variant: isActive ? "secondary" : "ghost",
                }),
                "justify-start",
              )
            }
            to={l.to}
          >
            {l.icon}
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
