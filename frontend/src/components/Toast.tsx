import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import './Toast.css';

const icons = {
  success: <CheckCircle2 size={18} />,
  error: <AlertCircle size={18} />,
  info: <Info size={18} />,
};

const ToastContainer: React.FC = () => {
  const { toasts, remove } = useToast();

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className={`toast-icon toast-icon-${t.type}`}>{icons[t.type]}</span>
          <span className="toast-message">{t.message}</span>
          <button className="toast-close" onClick={() => remove(t.id)} aria-label="Fechar">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
