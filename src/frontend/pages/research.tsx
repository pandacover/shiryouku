import { useChat } from "@ai-sdk/react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { isReasoningUIPart, isTextUIPart, isToolUIPart } from "ai";
import type { ReasoningUIPart, TextUIPart, ToolUIPart, UIMessage } from "ai";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { BrainIcon, SearchIcon } from "lucide-react";

type KeywordSearchResult = {
  matches: { chunkId: string; text: string }[];
  doc: { id: string; name: string };
};

type KeywordSearchToolPart = ToolUIPart<{
  keyword_search: {
    input: {
      query: string,
      limit: number
    };
    output: { context: string };
  };
}>;

type ThoughtPart = ReasoningUIPart | ToolUIPart | KeywordSearchToolPart;

function isKeywordSearchTool(part: ThoughtPart): part is KeywordSearchToolPart {
  return part.type.startsWith("tool-");
}

function classifyParts(message: UIMessage) {
  const text: TextUIPart[] = [];
  const thoughts: ThoughtPart[] = [];

  for (const part of message.parts) {
    if (isTextUIPart(part)) {
      text.push(part);
    } else if (isReasoningUIPart(part) || isToolUIPart(part)) {
      thoughts.push(part as ThoughtPart);
    }
  }

  return { text, thoughts };
}

export const ResearchPage = () => {
  const { messages, sendMessage, status } = useChat();

  const onSubmit = ({ text }: { text: string }) => {
    sendMessage({ text });
  };

  const renderMessage = (message: UIMessage) => {
    const { text, thoughts } = classifyParts(message);

    const getStatus = (state: string) =>
      state === "done" ? ("complete" as const) : ("active" as const);

    return (
      <div key={message.id}>
        {thoughts.length > 0 && (
          <ChainOfThought>
            <ChainOfThoughtHeader />
            <ChainOfThoughtContent>
              {thoughts.map((part, i) => {
                const key = `thought-${message.id}-${i}`;
                const status = getStatus(
                  "state" in part ? (part.state ?? "done") : "done",
                );

                if (isKeywordSearchTool(part)) {
                  return <ChainOfThoughtStep
                    key={`chain-of-thought-tool-${message.id}-${i}`}
                    icon={SearchIcon}
                    status={status}
                    label={part.input?.query}
                  />
                }

                if (isReasoningUIPart(part)) {
                  return (
                    <ChainOfThoughtStep
                      key={key}
                      // icon={BrainIcon}
                      status={status}
                      label={part.text}
                    />
                  );
                }

                return null;
              })}
            </ChainOfThoughtContent>
          </ChainOfThought>
        )}
        <div className="w-full py-2" />
        {text.map((m, i) => (
          <Message from={message.role} key={`${message.id}-${i}`}>
            <MessageContent>
              <MessageResponse>{m.text}</MessageResponse>
            </MessageContent>
          </Message>
        ))}
      </div>
    );
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col relative">
      <Conversation className="min-h-0 flex-1 overflow-y-auto">
        <ConversationContent className="p-6">
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="Start a chat to run research queries."
              title="No research messages yet"
            />
          ) : (
            messages.map(renderMessage)
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="sticky bottom-0 backdrop-blur-sm">
        <PromptInput onSubmit={onSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Ask a research question..." />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger tooltip="Add context" />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                  <PromptInputActionAddScreenshot />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  );
};
