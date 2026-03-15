import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polygon, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Shield, Zap, Globe } from 'lucide-react-native';
import { colors } from '../theme';
import { Button } from '../components/ui/Button';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FEATURES = [
  {
    icon: Shield,
    title: 'Military-Grade Security',
    description: 'AES-256 encryption with keys stored only on your device',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: '3-second block times with zero transaction fees',
  },
  {
    icon: Globe,
    title: 'Full dApp Support',
    description: 'Sign transactions for any Hive dApp seamlessly',
  },
];

const SignetLogo: React.FC = () => {
  const size = 100;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  // Hexagon points
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');

  return (
    <View style={styles.logoContainer}>
      <View style={styles.logoGlow} />
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="hexGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.hiveLight} />
            <Stop offset="100%" stopColor={colors.hiveDark} />
          </RadialGradient>
        </Defs>
        <Polygon
          points={points}
          fill="url(#hexGrad)"
          stroke={colors.hiveLight}
          strokeWidth={1.5}
        />
      </Svg>
      <Text style={styles.logoLetter}>S</Text>
    </View>
  );
};

const FeatureItem: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
}> = ({ icon: Icon, title, description }) => (
  <View style={styles.featureItem}>
    <View style={styles.featureIconContainer}>
      <Icon size={20} color={colors.hive} />
    </View>
    <View style={styles.featureText}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

export const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.content}>
        {/* Logo Section */}
        <View style={styles.heroSection}>
          <SignetLogo />
          <Text style={styles.heading}>Signet</Text>
          <Text style={styles.subheading}>
            The secure wallet for the Hive blockchain. Manage your keys, tokens,
            and dApp interactions with confidence.
          </Text>
        </View>

        {/* Feature Highlights */}
        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <FeatureItem
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => navigation.navigate('CreatePassword')}
          >
            Get Started
          </Button>

          <View style={styles.securityNote}>
            <Shield size={14} color={colors.textTertiary} />
            <Text style={styles.securityNoteText}>
              Your keys never leave this device
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(227,19,55,0.15)',
    ...Platform.select({
      ios: {
        shadowColor: colors.hive,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 40,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  logoLetter: {
    position: 'absolute',
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heading: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: SCREEN_WIDTH * 0.8,
  },
  features: {
    width: '100%',
    gap: 16,
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(227,19,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  featureDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  securityNoteText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});

export default WelcomeScreen;
