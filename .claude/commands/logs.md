---
description: View server logs from production
---

# View Production Logs

Fetch logs from production server containers.

## Server Logs (last 50 lines)
```bash
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no root@91.222.239.217 "docker logs neurodirectolog-server --tail 50 2>&1"
```

## Server Logs with grep
```bash
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no root@91.222.239.217 "docker logs neurodirectolog-server 2>&1 | grep -i '$ARGUMENTS' | tail -30"
```

## Follow logs (real-time)
```bash
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no root@91.222.239.217 "docker logs neurodirectolog-server -f --tail 20"
```

## Check running containers
```bash
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no root@91.222.239.217 "docker ps | grep neurodirectolog"
```

## Arguments
$ARGUMENTS - Optional filter term for grep (e.g., "error", "sync", "api")
