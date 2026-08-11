import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Role } from '@crewly/shared';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useAuthStore } from '../../store/authStore';
import { apiFetch } from '../../lib/api';
import { humanize } from '../../lib/format';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  isActive: boolean;
  assignedSites: { projectId: string; name: string }[];
}

interface ProjectOption {
  _id: string;
  name: string;
}

const ROLES = Object.values(Role);
const MIN_PASSWORD_LENGTH = 8;

interface FormState {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: Role;
  assignedSites: string[];
  isActive: boolean;
}

function emptyForm(): FormState {
  return {
    name: '',
    email: '',
    password: '',
    phone: '',
    role: Role.SITE_SUPERVISOR,
    assignedSites: [],
    isActive: true,
  };
}

export default function ManageUsers() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [usersRes, projectsRes] = await Promise.all([
      apiFetch<ManagedUser[]>('/users'),
      apiFetch<ProjectOption[]>('/projects'),
    ]);
    if (usersRes.success && usersRes.data) setUsers(usersRes.data);
    if (projectsRes.success && projectsRes.data) setProjects(projectsRes.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm());
    setFormError(null);
    setModalVisible(true);
  };

  const openEdit = (user: ManagedUser) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      phone: user.phone,
      role: user.role,
      assignedSites: user.assignedSites.map((site) => site.projectId),
      isActive: user.isActive,
    });
    setFormError(null);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('Name is required.');
      return;
    }
    if (!editingUser) {
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
        setFormError('Enter a valid email address.');
        return;
      }
      if (form.password.length < MIN_PASSWORD_LENGTH) {
        setFormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
    } else if (form.password && form.password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    setFormError(null);

    const result = editingUser
      ? await apiFetch(`/users/${editingUser.id}`, {
          method: 'PATCH',
          body: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            role: form.role,
            assignedSites: form.assignedSites,
            isActive: form.isActive,
            ...(form.password ? { password: form.password } : {}),
          },
        })
      : await apiFetch('/users', {
          method: 'POST',
          body: {
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            phone: form.phone.trim(),
            role: form.role,
            assignedSites: form.assignedSites,
          },
        });

    setSaving(false);

    if (result.success) {
      setModalVisible(false);
      fetchData();
      if (!editingUser) {
        Alert.alert('User created', `${form.name.trim()} can now sign in with their email.`);
      }
    } else {
      setFormError(result.error?.message || 'Could not save the user.');
    }
  };

  const toggleSite = (projectId: string) => {
    setForm((prev) => ({
      ...prev,
      assignedSites: prev.assignedSites.includes(projectId)
        ? prev.assignedSites.filter((id) => id !== projectId)
        : [...prev.assignedSites, projectId],
    }));
  };

  const isEditingSelf = editingUser?.id === currentUserId;

  if (loading && users.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading users…</Text>
      </View>
    );
  }

  const grouped = ROLES.map((role) => ({
    role,
    members: users.filter((user) => user.role === role),
  })).filter((group) => group.members.length > 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={colors.role.owner}
          />
        }
      >
        {grouped.map((group) => (
          <View key={group.role} style={styles.section}>
            <Text style={styles.sectionTitle}>{humanize(group.role)}</Text>
            {group.members.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={userStyles.row}
                onPress={() => openEdit(user)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    userStyles.avatar,
                    { backgroundColor: roleColor(user.role) },
                    !user.isActive && userStyles.avatarInactive,
                  ]}
                >
                  <Text style={userStyles.avatarText}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={userStyles.info}>
                  <Text style={userStyles.name}>
                    {user.name}
                    {user.id === currentUserId ? ' (you)' : ''}
                  </Text>
                  <Text style={userStyles.email}>{user.email}</Text>
                  {user.assignedSites.length > 0 && (
                    <Text style={userStyles.sites} numberOfLines={1}>
                      📍 {user.assignedSites.map((site) => site.name).join(', ')}
                    </Text>
                  )}
                </View>
                {!user.isActive && (
                  <View style={userStyles.inactiveBadge}>
                    <Text style={userStyles.inactiveText}>Inactive</Text>
                  </View>
                )}
                <Text style={userStyles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
        <Text style={styles.fabText}>+ Add User</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={modalStyles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={modalStyles.sheet}>
            <Text style={modalStyles.title}>{editingUser ? 'Edit User' : 'New User'}</Text>

            <ScrollView style={modalStyles.scroll} keyboardShouldPersistTaps="handled">
              <Input
                label="Full name"
                required
                value={form.name}
                onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
                placeholder="e.g. Bilal Ahmed"
              />

              {editingUser ? (
                <View style={modalStyles.readOnlyRow}>
                  <Text style={modalStyles.readOnlyLabel}>Email</Text>
                  <Text style={modalStyles.readOnlyValue}>{editingUser.email}</Text>
                </View>
              ) : (
                <Input
                  label="Email"
                  required
                  value={form.email}
                  onChangeText={(email) => setForm((prev) => ({ ...prev, email }))}
                  placeholder="name@company.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              )}

              <Input
                label={editingUser ? 'Reset password (optional)' : 'Password'}
                required={!editingUser}
                value={form.password}
                onChangeText={(password) => setForm((prev) => ({ ...prev, password }))}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                secureTextEntry
                autoCapitalize="none"
              />

              <Input
                label="Phone (optional)"
                value={form.phone}
                onChangeText={(phone) => setForm((prev) => ({ ...prev, phone }))}
                placeholder="03xx-xxxxxxx"
                keyboardType="phone-pad"
              />

              <Text style={modalStyles.label}>Role</Text>
              <View style={modalStyles.chipRow}>
                {ROLES.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      modalStyles.chip,
                      form.role === role && modalStyles.chipSelected,
                      isEditingSelf && role !== form.role && modalStyles.chipDisabled,
                    ]}
                    onPress={() => setForm((prev) => ({ ...prev, role }))}
                    disabled={isEditingSelf}
                  >
                    <Text
                      style={[
                        modalStyles.chipText,
                        form.role === role && modalStyles.chipTextSelected,
                      ]}
                    >
                      {humanize(role)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {isEditingSelf && (
                <Text style={modalStyles.hint}>You cannot change your own role.</Text>
              )}

              <Text style={modalStyles.label}>Assigned sites</Text>
              {projects.length === 0 ? (
                <Text style={modalStyles.hint}>No projects to assign yet.</Text>
              ) : (
                <View style={modalStyles.chipRow}>
                  {projects.map((project) => (
                    <TouchableOpacity
                      key={project._id}
                      style={[
                        modalStyles.chip,
                        form.assignedSites.includes(project._id) && modalStyles.chipSelected,
                      ]}
                      onPress={() => toggleSite(project._id)}
                    >
                      <Text
                        style={[
                          modalStyles.chipText,
                          form.assignedSites.includes(project._id) && modalStyles.chipTextSelected,
                        ]}
                      >
                        {project.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {editingUser && (
                <View style={modalStyles.switchRow}>
                  <View style={modalStyles.switchLabelArea}>
                    <Text style={modalStyles.switchLabel}>Account active</Text>
                    <Text style={modalStyles.switchHint}>
                      {isEditingSelf
                        ? 'You cannot deactivate your own account.'
                        : 'Inactive users cannot sign in.'}
                    </Text>
                  </View>
                  <Switch
                    value={form.isActive}
                    onValueChange={(isActive) => setForm((prev) => ({ ...prev, isActive }))}
                    disabled={isEditingSelf}
                    trackColor={{ true: colors.role.owner, false: colors.neutral[300] }}
                  />
                </View>
              )}

              {formError && <Text style={modalStyles.error}>{formError}</Text>}
            </ScrollView>

            <View style={modalStyles.buttonRow}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setModalVisible(false)}
                style={modalStyles.flexButton}
              />
              <Button
                title={editingUser ? 'Save changes' : 'Create user'}
                onPress={handleSave}
                loading={saving}
                style={modalStyles.flexButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function roleColor(role: Role): string {
  return colors.role[role] ?? colors.primary[500];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...typography.body, color: colors.text.tertiary },
  content: { padding: spacing.lg, paddingBottom: spacing['6xl'] },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    ...typography.label,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    backgroundColor: colors.role.owner,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    borderRadius: borderRadius.full,
    ...shadows.lg,
  },
  fabText: { ...typography.button, color: colors.text.inverse },
});

const userStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarInactive: { opacity: 0.4 },
  avatarText: { ...typography.heading4, color: colors.text.inverse },
  info: { flex: 1 },
  name: { ...typography.body, color: colors.text.primary },
  email: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  sites: { ...typography.caption, color: colors.text.secondary, marginTop: spacing.xxs },
  inactiveBadge: {
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
  },
  inactiveText: { ...typography.caption, color: colors.text.tertiary },
  chevron: { ...typography.heading3, color: colors.neutral[400] },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.background.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing['2xl'],
    maxHeight: '92%',
  },
  scroll: { marginBottom: spacing.md },
  title: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.text.secondary, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.input,
  },
  chipSelected: { backgroundColor: colors.role.owner },
  chipDisabled: { opacity: 0.4 },
  chipText: { ...typography.bodySmall, color: colors.text.secondary },
  chipTextSelected: { color: colors.text.inverse, fontWeight: '600' },
  hint: { ...typography.caption, color: colors.text.tertiary, marginBottom: spacing.lg },
  readOnlyRow: { marginBottom: spacing.lg },
  readOnlyLabel: { ...typography.label, color: colors.text.secondary, marginBottom: spacing.xs },
  readOnlyValue: { ...typography.body, color: colors.text.tertiary },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    marginBottom: spacing.md,
  },
  switchLabelArea: { flex: 1, paddingRight: spacing.lg },
  switchLabel: { ...typography.body, color: colors.text.primary },
  switchHint: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  error: {
    ...typography.bodySmall,
    color: colors.danger.dark,
    backgroundColor: colors.danger.light,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  buttonRow: { flexDirection: 'row', gap: spacing.md },
  flexButton: { flex: 1 },
});
