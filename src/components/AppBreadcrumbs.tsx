import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

interface BreadcrumbConfig {
  label: string;
  parent?: string;
}

// Route configuration for breadcrumbs
const routeConfig: Record<string, BreadcrumbConfig> = {
  "/": { label: "Home" },
  "/role-picker": { label: "Choose Role", parent: "/" },
  "/scenes": { label: "Choose Scene", parent: "/role-picker" },
  "/section-picker": { label: "Choose Section", parent: "/scenes" },
  "/practice/cue-say-it": { label: "Cue → Say It", parent: "/role-picker" },
  "/practice/first-letter": { label: "First Letter", parent: "/role-picker" },
  "/practice/scramble": { label: "Scramble", parent: "/role-picker" },
  "/practice/plain-english": { label: "Plain English", parent: "/role-picker" },
  "/modern-english": { label: "Modern English", parent: "/" },
  "/modern-english-viewer": { label: "Plain English → Shakespeare", parent: "/role-picker" },
  "/admin": { label: "Admin", parent: "/" },
  "/admin/login": { label: "Login", parent: "/admin" },
  "/upload": { label: "Upload Script", parent: "/admin" },
  "/admin/translations": { label: "Translations", parent: "/admin" },
  "/admin/translations-review": { label: "Review Translations", parent: "/admin" },
  "/admin/translation-editor": { label: "Edit Translation", parent: "/admin/translations-review" },
  "/admin/script-fix": { label: "Script Fix", parent: "/admin" },
};

// Build breadcrumb trail from current path
function buildBreadcrumbTrail(pathname: string): { path: string; label: string }[] {
  const trail: { path: string; label: string }[] = [];
  
  // Normalize dynamic routes
  let normalizedPath = pathname;
  if (pathname.match(/^\/parse-review\/.+/)) {
    normalizedPath = "/parse-review";
  } else if (pathname.match(/^\/role-picker\/.+/)) {
    normalizedPath = "/role-picker";
  } else if (pathname.match(/^\/section-picker\/.+/)) {
    normalizedPath = "/section-picker";
  }

  // Add parse-review to config dynamically
  const dynamicConfig: Record<string, BreadcrumbConfig> = {
    ...routeConfig,
    "/parse-review": { label: "Parse Review", parent: "/upload" },
  };

  let currentPath: string | undefined = normalizedPath;
  
  while (currentPath && dynamicConfig[currentPath]) {
    const config = dynamicConfig[currentPath];
    trail.unshift({ path: currentPath, label: config.label });
    currentPath = config.parent;
  }

  return trail;
}

interface AppBreadcrumbsProps {
  className?: string;
}

const AppBreadcrumbs = ({ className }: AppBreadcrumbsProps) => {
  const location = useLocation();
  const trail = buildBreadcrumbTrail(location.pathname);

  // Don't show breadcrumbs on home page
  if (location.pathname === "/" || trail.length === 0) {
    return null;
  }

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {trail.map((item, index) => {
          const isLast = index === trail.length - 1;
          const isFirst = index === 0;

          return (
            <BreadcrumbItem key={item.path}>
              {index > 0 && <BreadcrumbSeparator />}
              {isLast ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={item.path} className="flex items-center gap-1">
                    {isFirst && item.path === "/" && <Home className="h-3.5 w-3.5" />}
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default AppBreadcrumbs;
