import { createContext, useContext } from 'react';

export const FeedbackContext = createContext(null);

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback phải được dùng bên trong FeedbackProvider');
  return context;
};
