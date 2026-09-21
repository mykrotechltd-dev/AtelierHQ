import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "atelierhq-ui";

export function Sizes() {
  return (
    <div className="flex items-center gap-4">
      <Avatar size="sm">
        <AvatarFallback>CO</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>AN</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>MA</AvatarFallback>
      </Avatar>
    </div>
  );
}

export function WithStatusBadge() {
  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg">
        <AvatarFallback>CO</AvatarFallback>
        <AvatarBadge />
      </Avatar>
      <Avatar>
        <AvatarFallback>AN</AvatarFallback>
        <AvatarBadge />
      </Avatar>
    </div>
  );
}

export function Group() {
  return (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>CO</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>AN</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>MB</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>
  );
}
