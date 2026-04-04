import { motion } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/**
 * Wrap page content for a smooth fade-in-up entrance.
 * Usage: <PageTransition>...content...</PageTransition>
 */
const PageTransition = ({ children, className = '' }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    className={className}
  >
    {children}
  </motion.div>
);

/**
 * Wrap a grid/list container so its children animate in sequentially.
 * Usage: <StaggerContainer>...stagger items...</StaggerContainer>
 */
const StaggerContainer = ({ children, className = '' }) => (
  <motion.div
    variants={staggerContainer}
    initial="initial"
    animate="animate"
    className={className}
  >
    {children}
  </motion.div>
);

/**
 * Individual staggered item — must be a direct child of StaggerContainer.
 */
const StaggerItem = ({ children, className = '' }) => (
  <motion.div variants={staggerItem} className={className}>
    {children}
  </motion.div>
);

export { PageTransition, StaggerContainer, StaggerItem };
export default PageTransition;
