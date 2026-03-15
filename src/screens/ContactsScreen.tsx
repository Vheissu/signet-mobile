import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  Search,
  Plus,
  Send,
  Edit2,
  Trash2,
  Users,
  UserPlus,
} from 'lucide-react-native';
import { colors } from '../theme';
import { useStore } from '../store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import {
  getContacts,
  saveContact,
  removeContact,
  searchContacts,
} from '../core/contacts';
import type { Contact } from '../core/contacts';
import { getAccount } from '../core/hive/client';
import { logger } from '../core/logger';

const ContactsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const addToast = useStore((s) => s.addToast);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  // Load contacts on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getContacts();
        if (!cancelled) {
          setContacts(loaded);
          setFilteredContacts(loaded);
        }
      } catch (err) {
        logger.error('[ContactsScreen] Failed to load contacts:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle search
  useEffect(() => {
    let cancelled = false;

    async function doSearch() {
      if (!searchQuery.trim()) {
        setFilteredContacts(contacts);
        return;
      }

      try {
        const results = await searchContacts(searchQuery);
        if (!cancelled) {
          setFilteredContacts(results);
        }
      } catch {
        // Fallback to local filter
        const query = searchQuery.toLowerCase();
        setFilteredContacts(
          contacts.filter(
            (c) =>
              c.username.toLowerCase().includes(query) ||
              (c.label && c.label.toLowerCase().includes(query)),
          ),
        );
      }
    }

    doSearch();
    return () => {
      cancelled = true;
    };
  }, [searchQuery, contacts]);

  const handleAddContact = useCallback(async () => {
    if (!newUsername.trim()) {
      Alert.alert('Error', 'Please enter a username.');
      return;
    }
    const cleaned = newUsername.replace('@', '').toLowerCase().trim();

    if (contacts.some((c) => c.username === cleaned)) {
      Alert.alert('Error', 'This contact already exists.');
      return;
    }

    setAddingContact(true);
    try {
      // Validate the account exists on chain
      const accountData = await getAccount(cleaned);
      if (!accountData) {
        Alert.alert(
          'Account Not Found',
          `@${cleaned} was not found on the Hive blockchain. Please check the username.`,
        );
        return;
      }

      const newContact: Contact = {
        username: cleaned,
        label: newNickname.trim() || undefined,
        lastUsed: Date.now(),
        useCount: 0,
      };

      await saveContact(newContact);

      // Reload contacts
      const updated = await getContacts();
      setContacts(updated);

      setNewUsername('');
      setNewNickname('');
      setShowAddModal(false);
      addToast({ type: 'success', message: `@${cleaned} added to contacts.` });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add contact.');
    } finally {
      setAddingContact(false);
    }
  }, [newUsername, newNickname, contacts, addToast]);

  const handleEditContact = useCallback(
    (contact: Contact) => {
      setEditingContact(contact);
      setEditNickname(contact.label || '');
      setShowEditModal(true);
    },
    [],
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingContact) return;
    try {
      await saveContact({
        ...editingContact,
        label: editNickname.trim() || undefined,
      });

      // Reload contacts
      const updated = await getContacts();
      setContacts(updated);

      setShowEditModal(false);
      setEditingContact(null);
      setEditNickname('');
      addToast({ type: 'success', message: 'Contact updated.' });
    } catch (e: any) {
      addToast({ type: 'error', message: e.message || 'Failed to update contact.' });
    }
  }, [editingContact, editNickname, addToast]);

  const handleDeleteContact = useCallback(
    (username: string) => {
      Alert.alert(
        'Remove Contact',
        `Remove @${username} from your contacts?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeContact(username);

                // Reload contacts
                const updated = await getContacts();
                setContacts(updated);

                addToast({ type: 'info', message: `@${username} removed from contacts.` });
              } catch (e: any) {
                addToast({ type: 'error', message: e.message || 'Failed to remove contact.' });
              }
            },
          },
        ],
      );
    },
    [addToast],
  );

  const handleSend = useCallback(
    (username: string) => {
      navigation.navigate('Send', { to: username });
    },
    [navigation],
  );

  const renderContact = ({ item }: { item: Contact }) => (
    <Card variant="default" padding="md" style={styles.contactCard}>
      <View style={styles.contactRow}>
        <Avatar username={item.username} size="md" />
        <View style={styles.contactInfo}>
          <Text style={styles.contactUsername}>@{item.username}</Text>
          {item.label ? (
            <Text style={styles.contactNickname}>{item.label}</Text>
          ) : (
            <Text style={styles.contactNoNickname}>No label</Text>
          )}
        </View>
        <View style={styles.contactActions}>
          <TouchableOpacity
            onPress={() => handleEditContact(item)}
            style={styles.contactActionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Edit2 size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleSend(item.username)}
            style={[styles.contactActionBtn, styles.sendBtn]}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Send size={16} color={colors.hive} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteContact(item.username)}
            style={[styles.contactActionBtn, styles.deleteBtn]}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Trash2 size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  const ListHeader = () => (
    <View style={styles.listHeader}>
      <Input
        placeholder="Search contacts..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        leftIcon={<Search size={16} color={colors.textTertiary} />}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.countRow}>
        <Users size={14} color={colors.textTertiary} />
        <Text style={styles.countText}>
          {filteredContacts.length} contact
          {filteredContacts.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.hive} />
      ) : (
        <>
          <UserPlus size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No Contacts</Text>
          <Text style={styles.emptyText}>
            {searchQuery
              ? `No contacts matching "${searchQuery}"`
              : 'Add contacts for quick transfers and easy access.'}
          </Text>
          {!searchQuery && (
            <Button
              variant="primary"
              size="md"
              onPress={() => setShowAddModal(true)}
              icon={<Plus size={16} color="#FFFFFF" />}
            >
              Add Contact
            </Button>
          )}
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contacts</Text>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          style={styles.addButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Plus size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={loading ? [] : filteredContacts}
        keyExtractor={(item) => item.username}
        renderItem={renderContact}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      {/* Add Contact Modal */}
      <Modal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewUsername('');
          setNewNickname('');
        }}
        title="Add Contact"
      >
        <View style={styles.modalContent}>
          <Input
            label="Hive Username"
            placeholder="username"
            value={newUsername}
            onChangeText={(text: string) =>
              setNewUsername(text.replace('@', '').toLowerCase())
            }
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={
              <Text style={styles.atSymbol}>@</Text>
            }
          />

          <View style={styles.modalSpacer} />

          <Input
            label="Label (Optional)"
            placeholder="e.g., My Friend, Exchange"
            value={newNickname}
            onChangeText={setNewNickname}
          />

          <View style={styles.modalSpacer} />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={addingContact}
            onPress={handleAddContact}
            disabled={!newUsername.trim()}
            icon={<UserPlus size={16} color="#FFFFFF" />}
          >
            Add Contact
          </Button>
        </View>
      </Modal>

      {/* Edit Contact Modal */}
      <Modal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingContact(null);
          setEditNickname('');
        }}
        title="Edit Contact"
      >
        <View style={styles.modalContent}>
          {editingContact && (
            <>
              <View style={styles.editAccountRow}>
                <Avatar username={editingContact.username} size="md" />
                <Text style={styles.editUsername}>
                  @{editingContact.username}
                </Text>
              </View>

              <View style={styles.modalSpacer} />

              <Input
                label="Label"
                placeholder="Enter a label for this contact"
                value={editNickname}
                onChangeText={setEditNickname}
              />

              <View style={styles.modalSpacer} />

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={handleSaveEdit}
                icon={<Edit2 size={16} color="#FFFFFF" />}
              >
                Save Changes
              </Button>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 8,
  },
  listHeader: {
    gap: 10,
    marginBottom: 6,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  // Contact Card
  contactCard: {},
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  contactNickname: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  contactNoNickname: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surfaceOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    backgroundColor: 'rgba(227,19,55,0.1)',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239,71,111,0.1)',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
    marginBottom: 8,
  },
  // Modal
  modalContent: {
    gap: 4,
  },
  modalSpacer: {
    height: 12,
  },
  atSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  editAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceOverlay,
    borderRadius: 10,
  },
  editUsername: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

export default ContactsScreen;
