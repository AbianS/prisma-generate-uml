import { Handle, NodeProps, Position } from "reactflow"
import { Model } from "../lib/types/schema"

export const ModelNode = ({ data }: NodeProps<Model>) => {
  return (
    <div className="rounded-lg min-w-[250px]">
      {/* Renderiza el handle de destino */}
      {data.isChild && (
        <Handle id={data.name} position={Position.Top} type="target" />
      )}
      <div className="p-1 text-center rounded-t-lg rounded-b-none bg-[#3d5797]">
        <p className="font-bold text-white">
          <pre>{data.name}</pre>
        </p>
      </div>
      {data.fields.map(({ type, name, hasConnections }, index) => (
        <div
          key={name}
          className={`flex justify-between p-1 text-white ${
            index % 2 === 0 ? "bg-[#282828]" : "bg-[#232323]"
          }`}
        >
          <p>
            <pre>{name}</pre>
          </p>
          <p>
            <pre>{type}</pre>
          </p>
          {hasConnections && (
            <Handle
              position={Position.Right}
              id={`${data.name}-${name}`} // Asegúrate de que coincida con el sourceHandle
              type="source"
              style={{
                top: 27 + 16 + 27 * index,
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
