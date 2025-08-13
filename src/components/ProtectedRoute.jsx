// Simplified ProtectedRoute - No authentication required for internal company tool
const ProtectedRoute = ({ children }) => {
  // No authentication checks - direct access for internal company use
  return <div>{children}</div>;
};

export default ProtectedRoute;
