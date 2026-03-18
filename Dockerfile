# 使用轻量级 Nginx 镜像作为基础镜像
FROM nginx:alpine

# 复制构建后的文件到 Nginx 默认目录
COPY dist/ /usr/share/nginx/html/

# 复制自定义 Nginx 配置（如果需要的话）
# COPY nginx.conf /etc/nginx/nginx.conf

# 暴露 80 端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
