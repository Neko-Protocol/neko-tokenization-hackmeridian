export const ROUTES = {
  signup: "/signup",
  login: "/login",
  dashboard: "/dashboard",
  newAsset: "/assets/new",
  asset: (id: string) => `/assets/${id}`,
} as const;
