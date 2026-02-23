import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, MessageSquare, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatItem {
  id: string;
  chat_title: string;
  updated_at: string;
  messages: any[];
}

interface ChatListViewProps {
  chats: ChatItem[];
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onDeleteChat: (chatId: string) => void;
}

export default function ChatListView({ chats, onSelectChat, onNewChat, onRenameChat, onDeleteChat }: ChatListViewProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = (chat: ChatItem) => {
    setRenamingId(chat.id);
    setRenameValue(chat.chat_title);
  };

  const commitRename = (chatId: string) => {
    if (renameValue.trim()) {
      onRenameChat(chatId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
      <Button variant="outline" className="w-full justify-start gap-2 mb-3" onClick={onNewChat}>
        <Plus className="h-4 w-4" /> New Chat
      </Button>

      {chats.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">No chats yet. Start a new conversation!</p>
      )}

      {chats.map((chat) => (
        <div
          key={chat.id}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer group transition-colors"
          onClick={() => renamingId !== chat.id && onSelectChat(chat.id)}
        >
          <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            {renamingId === chat.id ? (
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => commitRename(chat.id)}
                onKeyDown={(e) => e.key === "Enter" && commitRename(chat.id)}
                className="h-7 text-sm"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <p className="text-sm font-medium truncate">{chat.chat_title}</p>
                <p className="text-xs text-muted-foreground">{chat.messages?.length || 0} messages</p>
              </>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); startRename(chat); }}>
                <Pencil className="h-3 w-3 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}>
                <Trash2 className="h-3 w-3 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
