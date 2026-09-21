import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, RotateCcw, X, ChevronDown, ChevronUp, Bot, User } from "lucide-react";
import { toast } from "sonner";

interface ReportChatPanelProps {
  clientId: number;
  clientName: string;
  onClose?: () => void;
}

const TONE_LABELS: Record<string, string> = {
  profissional: "Profissional",
  descontraido: "Descontraído",
  motivacional: "Motivacional",
  formal: "Formal",
};

const TONE_COLORS: Record<string, string> = {
  profissional: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  descontraido: "bg-green-500/20 text-green-400 border-green-500/30",
  motivacional: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  formal: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const QUICK_PROMPTS = [
  "Adiciona emojis nos títulos do relatório",
  "Muda o tom para mais descontraído",
  "Coloca uma frase motivacional no início",
  "Tom mais formal e profissional",
  "Destaca o ROAS em negrito",
  "Menciona sempre o nome do médico",
];

export function ReportChatPanel({ clientId, clientName, onClose }: ReportChatPanelProps) {
  const [message, setMessage] = useState("");
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading, refetch } = trpc.ai.getReportConfig.useQuery(
    { clientId },
    { refetchOnWindowFocus: false }
  );

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (result) => {
      setMessage("");
      refetch();
      if (result.hasChanges) {
        toast.success("Configuração do relatório atualizada!");
      }
    },
    onError: (err) => {
      toast.error("Erro ao enviar mensagem: " + err.message);
    },
  });

  const clearMutation = trpc.ai.clearHistory.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Histórico limpo!");
    },
  });

  const resetMutation = trpc.ai.resetConfig.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Configuração resetada para o padrão!");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.history]);

  const handleSend = () => {
    if (!message.trim() || chatMutation.isPending) return;
    chatMutation.mutate({ clientId, message: message.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const config = data?.config;
  const history = data?.history ?? [];

  return (
    <div className="flex flex-col h-full bg-[#0f1117] border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Personalizar Relatório</p>
            <p className="text-xs text-white/50">{clientName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-white/40 hover:text-white/70"
            onClick={() => clearMutation.mutate({ clientId })}
            title="Limpar histórico"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-white/40 hover:text-white/70"
              onClick={onClose}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Config Summary */}
      {config && (
        <div className="px-4 py-2 border-b border-white/5 bg-[#161b22]/50">
          <button
            className="w-full flex items-center justify-between text-xs text-white/50 hover:text-white/70 transition-colors"
            onClick={() => setIsConfigExpanded(!isConfigExpanded)}
          >
            <div className="flex items-center gap-2">
              <span>Configuração atual</span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 border ${TONE_COLORS[config.tone ?? "profissional"] ?? TONE_COLORS.profissional}`}
              >
                {TONE_LABELS[config.tone ?? "profissional"] ?? config.tone}
              </Badge>
            </div>
            {isConfigExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {isConfigExpanded && (
            <div className="mt-2 space-y-1.5 text-xs">
              {config.introText && (
                <div>
                  <span className="text-white/40">Introdução: </span>
                  <span className="text-white/70">{config.introText}</span>
                </div>
              )}
              {config.customInstructions && (
                <div>
                  <span className="text-white/40">Instruções: </span>
                  <span className="text-white/70">{config.customInstructions}</span>
                </div>
              )}
              {!config.introText && !config.customInstructions && (
                <p className="text-white/30 italic">Nenhuma personalização definida ainda.</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-red-400/70 hover:text-red-400 px-2 mt-1"
                onClick={() => resetMutation.mutate({ clientId })}
              >
                Resetar para padrão
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Sparkles className="w-8 h-8 text-purple-500/40 mb-2" />
            <p className="text-sm text-white/40">
              Olá! Sou sua assistente de relatórios.
            </p>
            <p className="text-xs text-white/30 mt-1">
              Diga o que quer mudar no formato do relatório.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
                    msg.role === "user"
                      ? "bg-blue-500/20"
                      : "bg-gradient-to-br from-purple-500 to-pink-500"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="w-3 h-3 text-blue-400" />
                  ) : (
                    <Bot className="w-3 h-3 text-white" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-500/20 text-white/90 rounded-tr-sm"
                      : "bg-white/5 text-white/80 rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-white/5 rounded-xl rounded-tl-sm px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Quick Prompts */}
      {history.length === 0 && !isLoading && (
        <div className="px-4 pb-2">
          <p className="text-[10px] text-white/30 mb-1.5">Sugestões rápidas:</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-white/50 hover:bg-purple-500/20 hover:text-purple-300 transition-colors border border-white/10 hover:border-purple-500/30"
                onClick={() => setMessage(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-white/5">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: adiciona emojis nos títulos..."
            className="min-h-[40px] max-h-[120px] resize-none bg-white/5 border-white/10 text-white/90 placeholder:text-white/30 text-sm rounded-xl focus:border-purple-500/50"
            rows={1}
          />
          <Button
            size="icon"
            className="w-9 h-9 flex-shrink-0 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border-0"
            onClick={handleSend}
            disabled={!message.trim() || chatMutation.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-white/20 mt-1.5 text-center">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
