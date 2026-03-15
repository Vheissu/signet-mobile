import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { CheckCircle, XCircle, Info } from 'lucide-react-native';
import { colors } from '../../theme';

// ---- Types ----

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// ---- Toast Store (simple pub/sub) ----

type Listener = (toasts: ToastMessage[]) => void;

let toasts: ToastMessage[] = [];
const listeners: Set<Listener> = new Set();

function emit() {
  listeners.forEach((l) => l([...toasts]));
}

export const toast = {
  success(title: string, message?: string, duration?: number) {
    toast._add('success', title, message, duration);
  },
  error(title: string, message?: string, duration?: number) {
    toast._add('error', title, message, duration);
  },
  info(title: string, message?: string, duration?: number) {
    toast._add('info', title, message, duration);
  },
  _add(type: ToastType, title: string, message?: string, duration?: number) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    toasts = [...toasts, { id, type, title, message, duration }];
    emit();
  },
  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

// ---- Config ----

const typeConfig: Record<
  ToastType,
  { icon: React.FC<any>; color: string; bg: string }
> = {
  success: {
    icon: CheckCircle,
    color: colors.success,
    bg: 'rgba(92,234,160,0.12)',
  },
  error: {
    icon: XCircle,
    color: colors.error,
    bg: 'rgba(239,71,111,0.12)',
  },
  info: {
    icon: Info,
    color: colors.info,
    bg: 'rgba(99,179,237,0.12)',
  },
};

// ---- Single Toast Item ----

interface ToastItemProps {
  item: ToastMessage;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ item, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(item.id);
    });
  }, [item.id, onDismiss, translateY, opacity]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 60,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(dismiss, item.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [dismiss, item.duration, translateY, opacity]);

  const config = typeConfig[item.type];
  const IconComponent = config.icon;

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: config.bg, transform: [{ translateY }], opacity },
      ]}
    >
      <TouchableOpacity
        style={styles.toastInner}
        activeOpacity={0.8}
        onPress={dismiss}
      >
        <IconComponent size={20} color={config.color} />
        <View style={styles.toastTextContainer}>
          <Text style={styles.toastTitle}>{item.title}</Text>
          {item.message ? (
            <Text style={styles.toastMessage}>{item.message}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ---- Toast Container ----

export const ToastContainer: React.FC = () => {
  const [items, setItems] = React.useState<ToastMessage[]>([]);

  useEffect(() => {
    return toast.subscribe(setItems);
  }, []);

  const handleDismiss = useCallback((id: string) => {
    toast.dismiss(id);
  }, []);

  if (items.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {items.map((item) => (
        <ToastItem key={item.id} item={item} onDismiss={handleDismiss} />
      ))}
    </View>
  );
};

// ---- Styles ----

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  toastTextContainer: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  toastMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

export default ToastContainer;
