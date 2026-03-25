import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image as ImageIcon, Palette, Send, Sparkles } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import SectionHeader from '../components/SectionHeader';
import SearchPickerDialog from '../components/SearchPickerDialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const welcomeSchema = z.object({
  channel_id: z.string().trim().min(1, 'This field is required'),
  title: z.string().trim().min(1, 'This field is required').max(120, 'Keep the title under 120 characters'),
  message: z.string().trim().min(1, 'This field is required').max(1000, 'Keep the message under 1000 characters'),
  image_url: z.string().trim().url('Enter a valid URL').or(z.literal('')),
  gif_url: z.string().trim().url('Enter a valid URL').or(z.literal('')),
  accent_color: z.string().trim().regex(/^#?[0-9a-fA-F]{6}$/, 'Enter a valid hex color'),
});

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-rose-300">{message}</p>;
}

export default function WelcomePage() {
  const dashboard = useDashboardContext();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const channelName = dashboard.channels.find((item) => String(item.id) === String(dashboard.welcome.channel_id || ''))?.name || 'No channel selected';

  const {
    register,
    reset,
    setValue,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(welcomeSchema),
    defaultValues: {
      channel_id: '',
      title: '',
      message: '',
      image_url: '',
      gif_url: '',
      accent_color: '#51A7FF',
    },
  });

  useEffect(() => {
    reset({
      channel_id: String(dashboard.welcome.channel_id || ''),
      title: dashboard.welcome.title || 'Welcome to IND Blades',
      message: dashboard.welcome.message || 'Welcome to the IND Blades family. Read the rules, grab your roles, and get ready to move with the fam.',
      image_url: dashboard.welcome.image_url || '',
      gif_url: dashboard.welcome.gif_url || '',
      accent_color: dashboard.welcome.accent_color || '#51A7FF',
    });
  }, [dashboard.welcome, reset]);

  const formValues = watch();
  const previewMediaUrl = formValues.gif_url || formValues.image_url;
  const previewColor = formValues.accent_color.startsWith('#') ? formValues.accent_color : `#${formValues.accent_color}`;
  const previewChannelName = dashboard.channels.find((item) => String(item.id) === String(formValues.channel_id || ''))?.name || channelName;

  const toggleWelcome = async () => {
    setSaving(true);
    try {
      await api.post('/api/welcome/toggle', { enabled: !dashboard.welcome.enabled });
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', dashboard.welcome.enabled ? 'Welcome flow disabled.' : 'Welcome flow enabled.', 'welcome-toggle');
    } catch (error) {
      dashboard.handleError(error, 'Unable to toggle the welcome flow.');
    } finally {
      setSaving(false);
    }
  };

  const saveWelcome = handleSubmit(async (values) => {
    setSaving(true);
    try {
      await api.post('/api/welcome/channel', { channel_id: values.channel_id });
      await api.post('/api/welcome/content', {
        title: values.title,
        message: values.message,
        image_url: values.image_url || '',
        gif_url: values.gif_url || '',
        accent_color: values.accent_color.startsWith('#') ? values.accent_color : `#${values.accent_color}`,
      });
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', 'Welcome settings saved.', 'welcome-save');
    } catch (error) {
      dashboard.handleError(error, 'Unable to update the welcome settings.');
    } finally {
      setSaving(false);
    }
  });

  const sendPreview = handleSubmit(async (values) => {
    setPreviewing(true);
    try {
      await api.post('/api/welcome/preview', {
        channel_id: values.channel_id,
        title: values.title,
        message: values.message,
        image_url: values.image_url || '',
        gif_url: values.gif_url || '',
        accent_color: values.accent_color.startsWith('#') ? values.accent_color : `#${values.accent_color}`,
      });
      dashboard.showToast('success', 'Welcome preview queued.', 'welcome-preview');
    } catch (error) {
      dashboard.handleError(error, 'Unable to queue the welcome preview.');
    } finally {
      setPreviewing(false);
    }
  });

  const mediaLabel = useMemo(() => {
    if (formValues.gif_url) return 'GIF Preview';
    if (formValues.image_url) return 'Image Preview';
    return 'No media selected';
  }, [formValues.gif_url, formValues.image_url]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Welcome"
        title="Welcome Panel"
        description="Customize the welcome embed, keep the preview in sync, and send the exact message shape through the bot."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Welcome Controls</CardTitle>
            <CardDescription>Configure text, media, color, and delivery channel for the welcome message.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="surface-soft flex items-center justify-between rounded-[24px] p-5">
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">Welcome Flow</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Status for new member greetings.</p>
              </div>
              <Badge variant={dashboard.welcome.enabled ? 'success' : 'danger'}>
                {dashboard.welcome.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Welcome Channel</label>
              <Button
                variant="secondary"
                className={`w-full justify-between ${errors.channel_id ? 'border border-rose-400/35 bg-rose-500/8' : ''}`}
                onClick={() => setPickerOpen(true)}
              >
                {previewChannelName}
                <span className="text-xs text-[var(--text-muted)]">Choose channel</span>
              </Button>
              <FieldError message={errors.channel_id?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Title</label>
              <input
                {...register('title')}
                className={`surface-soft h-12 w-full rounded-[22px] px-4 text-sm ${errors.title ? 'border border-rose-400/35 bg-rose-500/8' : ''}`}
                placeholder="Welcome to IND Blades"
              />
              <FieldError message={errors.title?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Message</label>
              <textarea
                {...register('message')}
                className={`surface-soft min-h-32 w-full rounded-[22px] px-4 py-3 text-sm ${errors.message ? 'border border-rose-400/35 bg-rose-500/8' : ''}`}
                placeholder="Welcome message body"
              />
              <FieldError message={errors.message?.message} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Image URL</label>
                <input
                  {...register('image_url')}
                  className={`surface-soft h-12 w-full rounded-[22px] px-4 text-sm ${errors.image_url ? 'border border-rose-400/35 bg-rose-500/8' : ''}`}
                  placeholder="https://example.com/banner.png"
                />
                <FieldError message={errors.image_url?.message} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">GIF URL</label>
                <input
                  {...register('gif_url')}
                  className={`surface-soft h-12 w-full rounded-[22px] px-4 text-sm ${errors.gif_url ? 'border border-rose-400/35 bg-rose-500/8' : ''}`}
                  placeholder="https://example.com/welcome.gif"
                />
                <FieldError message={errors.gif_url?.message} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Accent Color</label>
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-[18px] border border-[var(--border)]"
                  style={{ backgroundColor: previewColor }}
                />
                <input
                  {...register('accent_color')}
                  className={`surface-soft h-12 w-full rounded-[22px] px-4 text-sm ${errors.accent_color ? 'border border-rose-400/35 bg-rose-500/8' : ''}`}
                  placeholder="#51A7FF"
                />
                <Palette className="h-4 w-4 text-[var(--text-muted)]" />
              </div>
              <FieldError message={errors.accent_color?.message} />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button loading={saving} onClick={saveWelcome}>
                Save
              </Button>
              <Button variant="secondary" loading={saving} onClick={toggleWelcome}>
                {dashboard.welcome.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button variant="secondary" loading={previewing} onClick={sendPreview}>
                <Send className="h-4 w-4" />
                Send Preview
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-highlight overflow-hidden">
          <div className="border-b border-[var(--border)] px-6 py-5">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Discord Preview</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">Welcome Message</h3>
          </div>
          <CardContent className="space-y-5 p-6">
            <div className="rounded-[24px] border border-[var(--border)] bg-[#313338] p-4 shadow-[0_18px_48px_-30px_rgba(0,0,0,0.7)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5865F2] text-sm font-bold text-white">
                  IB
                </div>
                <div>
                  <p className="font-semibold text-white">IND Blades</p>
                  <p className="text-sm text-[#B5BAC1]">Today at 7:00 PM</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-[18px] border border-white/8 bg-[#2B2D31]">
                {previewMediaUrl ? (
                  <img src={previewMediaUrl} alt={mediaLabel} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-32 items-center justify-center bg-[#1E1F22] text-sm text-[#B5BAC1]">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    No banner or GIF selected
                  </div>
                )}
                <div className="border-t border-white/8 p-4">
                  <div className="flex gap-3">
                    <div className="w-1 rounded-full" style={{ backgroundColor: previewColor }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-white">
                        <Sparkles className="h-4 w-4" style={{ color: previewColor }} />
                        <span className="font-semibold">{formValues.title}</span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#DBDEE1]">{formValues.message}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="surface-soft rounded-[24px] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Preview Channel</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">{previewChannelName}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <SearchPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Choose Welcome Channel"
        description="Search and choose the Discord channel used for welcome messages."
        items={dashboard.channels.map((item) => ({ id: item.id, label: item.name, description: `Channel ID ${item.id}` }))}
        selectedIds={formValues.channel_id ? [String(formValues.channel_id)] : []}
        onConfirm={(ids) => setValue('channel_id', ids[0] || '', { shouldDirty: true, shouldValidate: true })}
        placeholder="Search channels"
      />
    </div>
  );
}
