import { useCallback, useState, useRef, useMemo } from "react";
import type {
    ReactFlowInstance,
    Node,
    Edge,
    OnConnectStartParams,
    OnConnectStart,
    OnConnectEnd,
} from "@xyflow/react";
import type { NodeType, NodeData, CustomWorkflowData } from "@/lib/types";
import {
    getSourcePortType,
    getTargetPortType,
    getNodeDefinition,
} from "@/lib/flow/node-registry";
import { isTypeCompatible } from "@/lib/utils";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { createNode, getUniqueNodeName } from "@/lib/flow/node-factory";
import type { CustomNodeItem } from "@/components/flow/flow-constants";
import { nativeItems } from "@/components/flow/flow-constants";

export function useNodeConnection(
    rfInstance: ReactFlowInstance | null,
    nodeDataMap: Record<string, NodeData>,
    edges: Edge[],
    customNodes: CustomNodeItem[],
) {
    const [connectionStartParams, setConnectionStartParams] =
        useState<OnConnectStartParams | null>(null);
    const connectionStartParamsRef = useRef<OnConnectStartParams | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [dropdownVisualPosition, setDropdownVisualPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);

    const clearConnectionParams = useCallback(() => {
        setConnectionStartParams(null);
        connectionStartParamsRef.current = null;
    }, []);

    const onConnectStart: OnConnectStart = useCallback((_event, params) => {
        setConnectionStartParams(params);
        connectionStartParamsRef.current = params;
    }, []);

    const onConnectEnd: OnConnectEnd = useCallback(
        (event, connectionState) => {
            if (
                !connectionState.isValid &&
                connectionStartParamsRef.current &&
                rfInstance
            ) {
                const { clientX, clientY } =
                    "clientX" in event ? event : event.touches[0];

                const position = rfInstance.screenToFlowPosition({
                    x: clientX,
                    y: clientY,
                });

                setDropdownPosition(position);
                setDropdownVisualPosition({ x: clientX, y: clientY });
                setDropdownOpen(true);
            } else if (connectionState.isValid) {
                clearConnectionParams();
            }
        },
        [rfInstance, clearConnectionParams],
    );

    const getCompatibleNodes = useCallback(
        (
            params: OnConnectStartParams,
        ): {
            native: (typeof nativeItems)[number][];
            custom: CustomNodeItem[];
        } => {
            if (!params.nodeId) return { native: [], custom: [] };
            const sourceNodeData = nodeDataMap[params.nodeId];
            if (!sourceNodeData) return { native: [], custom: [] };

            const mockNode = { data: sourceNodeData } as Node<NodeData>;

            const portType =
                params.handleType === "source"
                    ? getSourcePortType(mockNode, params.handleId)
                    : getTargetPortType(mockNode, params.handleId);

            const filteredNative = nativeItems.filter((item) => {
                const def = getNodeDefinition(item.type as NodeType);
                if (!def) return false;

                if (params.handleType === "source") {
                    return Object.values(def.inputs || {}).some((targetType) =>
                        isTypeCompatible(portType, targetType),
                    );
                } else {
                    return Object.values(def.outputs || {}).some((sourceType) =>
                        isTypeCompatible(sourceType, portType),
                    );
                }
            });

            const filteredCustom = customNodes.filter((item) => {
                if (params.handleType === "source") {
                    return (item.inputs || []).some((input) =>
                        isTypeCompatible(portType, input.type),
                    );
                } else {
                    return (item.outputs || []).some((output) =>
                        isTypeCompatible(output.type, portType),
                    );
                }
            });

            return { native: filteredNative, custom: filteredCustom };
        },
        [nodeDataMap, customNodes],
    );

    const handleSelectDropdownNode = useCallback(
        (type: NodeType, customNode?: CustomNodeItem) => {
            const params =
                connectionStartParams || connectionStartParamsRef.current;
            if (!dropdownPosition || !params || !rfInstance) return;

            const newNode = createNode(
                customNode ? "custom-workflow" : type,
                dropdownPosition,
            );

            // Ensure unique name
            const currentNodes = useFlowStore.getState().nodes;
            newNode.data = {
                ...newNode.data,
                name: getUniqueNodeName(currentNodes, newNode.data.name),
            } as NodeData;
            if (customNode) {
                const inputsRecord: Record<string, string> = {};
                customNode.inputs?.forEach((p) => {
                    inputsRecord[p.id] = p.type;
                });
                const outputsRecord: Record<string, string> = {};
                customNode.outputs?.forEach((p) => {
                    outputsRecord[p.id] = p.type;
                });

                newNode.data = {
                    ...newNode.data,
                    subWorkflowId: customNode.id,
                    name: customNode.name,
                    inputs: inputsRecord,
                    outputs: outputsRecord,
                } as CustomWorkflowData;
            }

            useFlowStore.getState().addNode(newNode);

            if (!params.nodeId) return;
            const sourceNode = useFlowStore
                .getState()
                .nodes.find((n) => n.id === params.nodeId);
            const sourceNodeData =
                sourceNode?.data || nodeDataMap[params.nodeId];
            if (sourceNodeData) {
                const sourcePortType =
                    params.handleType === "source"
                        ? getSourcePortType(
                              { data: sourceNodeData } as Node<NodeData>,
                              params.handleId,
                          )
                        : getTargetPortType(
                              { data: sourceNodeData } as Node<NodeData>,
                              params.handleId,
                          );

                const newDef = getNodeDefinition(newNode.data.type as NodeType);
                let targetHandle: string | null = null;

                if (params.handleType === "source") {
                    if (newNode.data.type === "custom-workflow") {
                        const cwData = newNode.data as CustomWorkflowData;
                        const inputs = Object.entries(cwData.inputs || {});
                        const match =
                            inputs.find(
                                ([, type]) => type === sourcePortType,
                            ) ??
                            inputs.find(([, type]) =>
                                isTypeCompatible(sourcePortType, type),
                            );
                        targetHandle = match ? match[0] : null;
                    } else if (newDef?.inputs) {
                        if (
                            newNode.data.type === "video" &&
                            sourcePortType === "image"
                        ) {
                            targetHandle = "image-input";
                        } else {
                            const inputs = Object.entries(newDef.inputs);
                            const match =
                                inputs.find(
                                    ([, type]) => type === sourcePortType,
                                ) ??
                                inputs.find(([, type]) =>
                                    isTypeCompatible(sourcePortType, type),
                                );
                            targetHandle = match ? match[0] : null;
                        }
                    }
                } else {
                    if (newNode.data.type === "custom-workflow") {
                        const cwData = newNode.data as CustomWorkflowData;
                        const outputs = Object.entries(cwData.outputs || {});
                        const match =
                            outputs.find(
                                ([, type]) => type === sourcePortType,
                            ) ??
                            outputs.find(([, type]) =>
                                isTypeCompatible(type, sourcePortType),
                            );
                        targetHandle = match ? match[0] : null;
                    } else if (newDef?.outputs) {
                        const outputs = Object.entries(newDef.outputs);
                        const match =
                            outputs.find(
                                ([, type]) => type === sourcePortType,
                            ) ??
                            outputs.find(([, type]) =>
                                isTypeCompatible(type, sourcePortType),
                            );
                        targetHandle = match ? match[0] : null;
                    }
                }

                if (targetHandle !== null && params.nodeId) {
                    const source =
                        params.handleType === "source"
                            ? params.nodeId
                            : newNode.id;
                    const sourceHandle =
                        (params.handleType === "source"
                            ? params.handleId
                            : targetHandle) || null;
                    const target =
                        params.handleType === "source"
                            ? newNode.id
                            : params.nodeId;
                    const targetHandleFinal =
                        (params.handleType === "source"
                            ? targetHandle
                            : params.handleId) || null;

                    useFlowStore.getState().onConnect({
                        source,
                        sourceHandle,
                        target,
                        targetHandle: targetHandleFinal,
                    });
                }
            }

            setDropdownOpen(false);
            clearConnectionParams();
        },
        [
            dropdownPosition,
            connectionStartParams,
            rfInstance,
            nodeDataMap,
            clearConnectionParams,
        ],
    );

    const compatibleNodes = useMemo(() => {
        if (!connectionStartParams) return { native: [], custom: [] };
        return getCompatibleNodes(connectionStartParams);
    }, [connectionStartParams, getCompatibleNodes]);

    return {
        connectionStartParams,
        dropdownOpen,
        setDropdownOpen,
        dropdownPosition,
        dropdownVisualPosition,
        clearConnectionParams,
        onConnectStart,
        onConnectEnd,
        compatibleNodes,
        handleSelectDropdownNode,
    };
}
