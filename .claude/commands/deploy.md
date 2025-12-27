---
description: Build and deploy changes to production server
---

# Deploy to Production

Execute full deployment to production server.

## Steps

1. **Build locally** (to catch errors early):
```bash
cd /Users/artemsubbotin/Desktop/Neurodirectolog
npm run build
```

2. **Commit changes** (if not committed):
```bash
git add -A
git commit -m "Deploy: [description]"
git push
```

3. **Deploy to server**:
```bash
sshpass -p 'c9R+eLvxtQJ-,x' ssh -o StrictHostKeyChecking=no root@91.222.239.217 "cd /root/neurodirectolog && git pull && docker-compose -f docker-compose.prod.yml build --parallel client server && docker stop neurodirectolog-client neurodirectolog-server 2>/dev/null; docker rm neurodirectolog-client neurodirectolog-server 2>/dev/null; docker run -d --name neurodirectolog-server --network neurodirectolog_neurodirectolog-network -p 3001:3001 --env-file /root/neurodirectolog/.env neurodirectolog_server:latest && docker run -d --name neurodirectolog-client --network neurodirectolog_neurodirectolog-network -p 3000:80 neurodirectolog_client:latest && docker ps | grep neurodirectolog"
```

4. **Verify deployment**:
- Check `docker ps` output shows both containers running
- Test the application at http://91.222.239.217:3000

## Arguments
$ARGUMENTS - Optional description of what's being deployed
