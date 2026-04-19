# Local / dev single-node Elasticsearch for DMS full-text (use with STORAGE_BACKEND=s3).
# Build: docker build -t dms-elasticsearch ./docker/elasticsearch
# Run:  docker run -p 9200:9200 -e discovery.type=single-node -e xpack.security.enabled=false dms-elasticsearch
FROM docker.elastic.co/elasticsearch/elasticsearch:8.14.3

ENV discovery.type=single-node
ENV xpack.security.enabled=false
ENV ES_JAVA_OPTS=-Xms512m -Xmx512m

EXPOSE 9200
