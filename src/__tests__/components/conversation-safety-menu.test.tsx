import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const addDoc = vi.fn(async (..._args: any[]) => ({ id: 'r1' }));
const toast = vi.fn();

vi.mock('@/firebase', () => ({
  useUser: () => ({ user: { uid: 'buyer' } }),
  useFirestore: () => ({}),
}));
vi.mock('firebase/firestore', () => ({
  addDoc: (...args: any[]) => addDoc(...args),
  collection: (_db: unknown, path: string) => ({ path }),
  serverTimestamp: () => 'SERVER_TS',
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

import { ConversationSafetyMenu } from '@/components/messages/conversation-safety-menu';

// Radix positions menus with floating-ui, which needs these in jsdom.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
});

beforeEach(() => {
  addDoc.mockClear();
  toast.mockClear();
});

const member = { userId: 'seller', name: 'Gigi' };

function setup(isBlocked = false) {
  const memberBlock = {
    isBlocked,
    isLoading: false,
    block: vi.fn(async () => {}),
    unblock: vi.fn(async () => {}),
  };
  render(<ConversationSafetyMenu member={member} conversationId="c1" memberBlock={memberBlock} />);
  return memberBlock;
}

function openMenu() {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Conversation options' }), { key: 'Enter' });
}

describe('ConversationSafetyMenu', () => {
  it('offers Report and Block for someone not blocked', async () => {
    setup();
    openMenu();
    expect(await screen.findByRole('menuitem', { name: /Report Gigi/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Block Gigi/ })).toBeInTheDocument();
  });

  it('files a pending report in the reporter\'s name, with the thread attached', async () => {
    setup();
    openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Report Gigi/ }));

    const send = await screen.findByRole('button', { name: 'Send report' });
    expect(send).toBeDisabled(); // a reason is required

    fireEvent.click(screen.getByLabelText('Harassment or threats'));
    fireEvent.change(screen.getByLabelText(/What happened/), { target: { value: 'Threatened me' } });
    fireEvent.click(send);

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
    const [col, data] = addDoc.mock.calls[0];
    expect(col).toEqual({ path: 'reports' });
    expect(data).toMatchObject({
      type: 'user',
      itemId: 'seller',
      reportedUserId: 'seller',
      reporterId: 'buyer',
      conversationId: 'c1',
      reason: 'harassment',
      details: 'Threatened me',
      status: 'pending',
      createdAt: 'SERVER_TS',
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Report sent' }));
  });

  it('can block in the same step as reporting', async () => {
    const memberBlock = setup();
    openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Report Gigi/ }));
    fireEvent.click(await screen.findByLabelText('Spam'));
    fireEvent.click(screen.getByLabelText('Also block Gigi'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(memberBlock.block).toHaveBeenCalledWith('c1'));
    expect(addDoc).toHaveBeenCalledTimes(1);
  });

  it('asks before blocking, then blocks', async () => {
    const memberBlock = setup();
    openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Block Gigi/ }));

    expect(await screen.findByText('Block Gigi?')).toBeInTheDocument();
    expect(memberBlock.block).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    await waitFor(() => expect(memberBlock.block).toHaveBeenCalledWith('c1'));
  });

  it('offers Unblock once blocked, and no second block from the report dialog', async () => {
    const memberBlock = setup(true);
    openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Unblock Gigi/ }));
    await waitFor(() => expect(memberBlock.unblock).toHaveBeenCalled());

    openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Report Gigi/ }));
    await screen.findByRole('button', { name: 'Send report' });
    expect(screen.queryByLabelText('Also block Gigi')).not.toBeInTheDocument();
  });
});
