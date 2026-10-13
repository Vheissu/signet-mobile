/**
 * In-app dApp browser.
 *
 * Loads Hive web apps in a WebView with a Keychain-compatible
 * `window.hive_keychain` injected, so PeakD, Ecency, Splinterlands and
 * friends can sign with the keys stored in Signet. Every request goes
 * through the approval screen; the page only ever receives signatures
 * and broadcast results.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Linking,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Home,
  Lock,
  RotateCw,
  Search,
  X,
} from 'lucide-react-native';
import { colors } from '../theme';
import { useStore } from '../store';
import { INJECTED_BRIDGE, deliverScript, parseBridgeMessage } from '../core/dapp/inject';
import { isDAppRequestType } from '../core/dapp/requests';
import { logger } from '../core/logger';

interface Site {
  name: string;
  url: string;
  blurb: string;
}

const FEATURED: Site[] = [
  { name: 'PeakD', url: 'https://peakd.com', blurb: 'Full-featured Hive front end' },
  { name: 'Ecency', url: 'https://ecency.com', blurb: 'Blogging and communities' },
  { name: 'Hive.blog', url: 'https://hive.blog', blurb: 'The reference interface' },
  { name: 'InLeo', url: 'https://inleo.io', blurb: 'Short-form and finance threads' },
  { name: 'Splinterlands', url: 'https://splinterlands.com', blurb: 'Collectible card game' },
  { name: '3Speak', url: 'https://3speak.tv', blurb: 'Video platform' },
  { name: 'Tribaldex', url: 'https://tribaldex.com', blurb: 'Hive Engine token exchange' },
  { name: 'Hive Engine', url: 'https://hive-engine.com', blurb: 'Sidechain tokens and markets' },
  { name: 'Actifit', url: 'https://actifit.io', blurb: 'Move to earn' },
  { name: 'HiveHub', url: 'https://hivehub.dev', blurb: 'Block explorer' },
];

const RECENT_KEY = 'signet_browser_recent';
const MAX_RECENT = 8;

function normaliseUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export const BrowserScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const enqueueRequest = useStore((s) => s.enqueueRequest);
  const activeAccountName = useStore((s) => s.activeAccountName);

  const webviewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [editing, setEditing] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<Site[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then((raw) => {
        if (raw) setRecent(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  const remember = useCallback((url: string) => {
    const host = hostOf(url);
    setRecent((prev) => {
      const next = [{ name: host, url, blurb: '' }, ...prev.filter((s) => hostOf(s.url) !== host)].slice(
        0,
        MAX_RECENT,
      );
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const open = useCallback(
    (input: string) => {
      const url = normaliseUrl(input);
      if (!url) return;
      Keyboard.dismiss();
      setEditing(false);
      setCurrentUrl(url);
      setAddress(url);
      remember(url);
    },
    [remember],
  );

  const goHome = useCallback(() => {
    setCurrentUrl(null);
    setAddress('');
    setEditing(false);
    setCanGoBack(false);
    setCanGoForward(false);
  }, []);

  const handleNavigation = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    setCanGoForward(nav.canGoForward);
    setLoading(nav.loading);
    if (nav.url && !nav.loading) {
      setAddress(nav.url);
    }
  }, []);

  /**
   * Only http(s) loads inside the WebView. Our own schemes are handed to
   * the OS, which routes them back into the deep-link handler; anything
   * else (mailto, tel, app links) is opened externally.
   */
  const handleShouldStart = useCallback((event: { url: string }) => {
    const { url } = event;
    if (/^https?:/i.test(url)) return true;
    if (/^(signet|hive|mailto|tel):/i.test(url)) {
      Linking.openURL(url).catch(() => {});
    }
    return false;
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseBridgeMessage(event.nativeEvent.data);
      if (!message) return;

      const pageUrl = event.nativeEvent.url || currentUrl || '';
      const host = hostOf(pageUrl);
      const deliver = (response: unknown) => {
        webviewRef.current?.injectJavaScript(deliverScript(message.requestId, response));
      };

      if (!isDAppRequestType(message.type)) {
        deliver({
          success: false,
          error: 'unsupported',
          result: null,
          data: message.payload,
          message: `Unsupported request type: ${message.type}`,
          request_id: message.requestId,
        });
        return;
      }

      enqueueRequest({
        request: {
          id: message.requestId,
          type: message.type,
          payload: message.payload,
          origin: host,
          timestamp: Date.now(),
        },
        origin: { kind: 'browser', url: pageUrl, host },
        respond: deliver,
      });
    },
    [currentUrl, enqueueRequest],
  );

  const sites = useMemo(() => {
    const seen = new Set(recent.map((s) => hostOf(s.url)));
    return FEATURED.filter((s) => !seen.has(hostOf(s.url)));
  }, [recent]);

  const renderSite = ({ item }: { item: Site }) => (
    <TouchableOpacity style={styles.siteRow} onPress={() => open(item.url)} activeOpacity={0.7}>
      <View style={styles.siteBadge}>
        <Text style={styles.siteBadgeText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.siteText}>
        <Text style={styles.siteName}>{item.name}</Text>
        <Text style={styles.siteBlurb} numberOfLines={1}>
          {item.blurb || hostOf(item.url)}
        </Text>
      </View>
      <ArrowRight size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Address bar */}
      <View style={styles.bar}>
        {currentUrl ? (
          <TouchableOpacity style={styles.barButton} onPress={goHome} hitSlop={8}>
            <Home size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.barButton}>
            <Compass size={18} color={colors.hive} />
          </View>
        )}

        <View style={[styles.addressBox, editing && styles.addressBoxFocused]}>
          {!editing && currentUrl && /^https:/.test(currentUrl) ? (
            <Lock size={12} color={colors.success} />
          ) : (
            <Search size={12} color={colors.textTertiary} />
          )}
          <TextInput
            value={editing ? address : currentUrl ? hostOf(address || currentUrl) : address}
            onChangeText={setAddress}
            onFocus={() => {
              setEditing(true);
              setAddress(currentUrl || '');
            }}
            onBlur={() => setEditing(false)}
            onSubmitEditing={() => open(address)}
            placeholder="Search or enter a site"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectTextOnFocus
            style={styles.addressInput}
          />
          {editing && address.length > 0 && (
            <TouchableOpacity onPress={() => setAddress('')} hitSlop={8}>
              <X size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {currentUrl ? (
          <TouchableOpacity
            style={styles.barButton}
            onPress={() => (loading ? webviewRef.current?.stopLoading() : webviewRef.current?.reload())}
            hitSlop={8}
          >
            {loading ? (
              <X size={18} color={colors.textSecondary} />
            ) : (
              <RotateCw size={18} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {currentUrl ? (
        <>
          <WebView
            ref={webviewRef}
            source={{ uri: currentUrl }}
            style={styles.webview}
            injectedJavaScriptBeforeContentLoaded={INJECTED_BRIDGE}
            injectedJavaScript={INJECTED_BRIDGE}
            injectedJavaScriptBeforeContentLoadedForMainFrameOnly
            onMessage={handleMessage}
            onNavigationStateChange={handleNavigation}
            onShouldStartLoadWithRequest={handleShouldStart}
            onError={(e) => logger.warn('[Browser] load error:', e.nativeEvent.description)}
            allowsBackForwardNavigationGestures
            pullToRefreshEnabled
            setSupportMultipleWindows={false}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            sharedCookiesEnabled
            applicationNameForUserAgent="Signet"
          />
          <View style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TouchableOpacity
              style={styles.toolButton}
              disabled={!canGoBack}
              onPress={() => webviewRef.current?.goBack()}
            >
              <ArrowLeft size={20} color={canGoBack ? colors.textPrimary : colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolButton}
              disabled={!canGoForward}
              onPress={() => webviewRef.current?.goForward()}
            >
              <ArrowRight size={20} color={canGoForward ? colors.textPrimary : colors.textTertiary} />
            </TouchableOpacity>
            <View style={styles.toolSpacer} />
            <Text style={styles.toolAccount} numberOfLines={1}>
              {activeAccountName ? `Signing as @${activeAccountName}` : 'No account selected'}
            </Text>
          </View>
        </>
      ) : (
        <SectionList
          sections={[
            ...(recent.length > 0 ? [{ title: 'Recent', data: recent }] : []),
            { title: 'Featured', data: sites },
          ]}
          keyExtractor={(item) => item.url}
          renderItem={renderSite}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionLabel}>{section.title}</Text>
          )}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={styles.intro}>
              <Text style={styles.introTitle}>Hive apps, signed here</Text>
              <Text style={styles.introText}>
                Sites that support Hive Keychain work in this browser. When an app asks to vote,
                post or send, Signet shows you exactly what will be signed before anything leaves
                your wallet.
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={<View style={{ height: insets.bottom + 16 }} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  barButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressBoxFocused: {
    borderColor: 'rgba(227,19,55,0.5)',
  },
  addressInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  toolButton: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolSpacer: {
    flex: 1,
  },
  toolAccount: {
    fontSize: 12,
    color: colors.textTertiary,
    paddingRight: 8,
    maxWidth: '60%',
  },
  list: {
    paddingHorizontal: 16,
  },
  intro: {
    paddingTop: 20,
    paddingBottom: 8,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingTop: 16,
    paddingBottom: 4,
    backgroundColor: colors.bg,
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  siteBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  siteText: {
    flex: 1,
  },
  siteName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  siteBlurb: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 1,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 52,
  },
});

export default BrowserScreen;
