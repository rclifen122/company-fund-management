export const isDevelopmentMode = () => {
  return !import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
    import.meta.env.VITE_DEV_MODE === 'true';
};
